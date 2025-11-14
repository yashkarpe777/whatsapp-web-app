import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CampaignJob } from './entities/campaign-job.entity';
import { SentMessage } from './entities/sent-message.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { DispatchJobStatus } from './types/dispatch-job';
import { WHATSAPP_ADAPTER, WhatsAppAdapter } from './adapters/whatsapp.adapter';

interface ClaimedJobResult {
  job: CampaignJob;
}

@Injectable()
export class DispatchWorker {
  private readonly logger = new Logger(DispatchWorker.name);
  private processing = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CampaignJob)
    private readonly campaignJobRepo: Repository<CampaignJob>,
    @InjectRepository(SentMessage)
    private readonly sentMessageRepo: Repository<SentMessage>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @Inject(WHATSAPP_ADAPTER)
    private readonly whatsappAdapter: WhatsAppAdapter,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleTick(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      const claimed = await this.claimNextJob();
      if (!claimed) {
        return;
      }

      await this.processJob(claimed.job);
    } catch (error) {
      this.logger.error('Dispatch worker tick failed', error instanceof Error ? error.stack : error);
    } finally {
      this.processing = false;
    }
  }

  private async claimNextJob(): Promise<ClaimedJobResult | null> {
    return this.dataSource.transaction(async (manager) => {
      const rows: CampaignJob[] = await manager.query(
        `SELECT * FROM campaign_jobs
         WHERE status = $1
         ORDER BY queued_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        ['queued'],
      );

      if (!rows.length) {
        return null;
      }

      const job = await manager.getRepository(CampaignJob).findOne({ where: { id: rows[0].id } });
      if (!job) {
        return null;
      }

      job.status = 'in_progress';
      job.startedAt = new Date();
      job.attempt = (job.attempt ?? 0) + 1;
      await manager.getRepository(CampaignJob).save(job);

      return { job };
    });
  }

  private async processJob(job: CampaignJob): Promise<void> {
    try {
      const recipients = await this.contactRepo.find({
        where: {
          user: { id: job.userId },
          is_active: true,
        },
        order: {
          created_at: 'ASC',
        },
        take: job.size,
      });

      if (!recipients.length) {
        await this.markJob(job, 'failed', 'No active contacts available for this campaign');
        return;
      }

      const processed = await this.dispatchRecipients(job, recipients.map((contact) => contact.phone));
      await this.finaliseJob(job, processed);
    } catch (error) {
      this.logger.error(`Failed processing job ${job.jobId}`, error instanceof Error ? error.stack : error);
      await this.markJob(job, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async dispatchRecipients(
    job: CampaignJob,
    phones: string[],
  ): Promise<{ total: number; successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const phone of phones) {
      const queuedMessage = this.sentMessageRepo.create({
        campaignId: job.campaignId,
        campaignJobId: job.id,
        toPhone: phone,
        status: 'pending',
        virtualNumberId: job.virtualNumberId ?? undefined,
        businessNumberId: job.businessNumberId ?? undefined,
        caption: job.caption ?? null,
        mediaUrl: job.mediaUrl ?? null,
        mediaType: job.mediaType ?? null,
        mediaName: job.mediaName ?? null,
        cta: job.cta ?? null,
        metadata: { jobId: job.jobId },
      });

      const message = await this.sentMessageRepo.save(queuedMessage);

      try {
        const result = await this.whatsappAdapter.send({
          to: phone,
          campaignId: job.campaignId,
          jobId: job.jobId,
          caption: job.caption ?? null,
          media_url: job.mediaUrl ?? null,
          media_type: job.mediaType ?? null,
          media_name: job.mediaName ?? null,
          cta: job.cta ?? null,
        });

        if (result.status === 'sent') {
          message.status = 'sent';
          message.sentAt = new Date();
          successful += 1;
        } else {
          message.status = 'failed';
          message.errorCode = result.errorCode;
          message.errorMessage = result.errorMessage;
          message.lastErrorAt = new Date();
          failed += 1;
        }
      } catch (error) {
        message.status = 'failed';
        message.errorCode = 'SEND_EXCEPTION';
        message.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        message.lastErrorAt = new Date();
        failed += 1;
      }

      await this.sentMessageRepo.save(message);
    }

    if (phones.length) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'sentCount', phones.length);
    }
    if (successful) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'successCount', successful);
    }
    if (failed) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'failedCount', failed);
    }

    return { total: phones.length, successful, failed };
  }

  private async finaliseJob(
    job: CampaignJob,
    result: { total: number; successful: number; failed: number },
  ): Promise<void> {
    job.status = result.failed && !result.successful ? 'failed' : 'completed';
    job.finishedAt = new Date();
    job.error = result.failed ? `Failed to deliver ${result.failed} message(s)` : null;
    await this.campaignJobRepo.save(job);

    this.logger.log(
      `Processed campaign job ${job.jobId}: total=${result.total} success=${result.successful} failed=${result.failed}`,
    );
  }

  private async markJob(job: CampaignJob, status: DispatchJobStatus, reason?: string): Promise<void> {
    job.status = status;
    job.finishedAt = new Date();
    job.error = reason ?? null;
    await this.campaignJobRepo.save(job);
  }
}
