import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CampaignJob } from './entities/campaign-job.entity';
import { SentMessage } from './entities/sent-message.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Campaign, CampaignContact } from '../campaigns/entities/campaign.entity';
import { DispatchJobStatus } from './types/dispatch-job';
import { WHATSAPP_ADAPTER, WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { CleanupService } from '../queues/cleanup.service';
import { ConfigService } from '@nestjs/config';

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
    @InjectRepository(CampaignContact)
    private readonly campaignContactRepo: Repository<CampaignContact>,
    @Inject(WHATSAPP_ADAPTER)
    private readonly whatsappAdapter: WhatsAppAdapter,
    private readonly cleanupService: CleanupService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logRetentionMs = this.resolveRetentionMs('LOG_RETENTION_DAYS', 30);
  private readonly retryRetentionMs = this.resolveRetentionMs('RETRY_RETENTION_DAYS', 7);

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
      const campaignContacts = await this.campaignContactRepo.find({
        where: {
          campaignId: job.campaignId,
          jobId: job.jobId,
        },
        relations: ['contact'],
        order: { sequence: 'ASC' },
      });

      const recipients = campaignContacts
        .map((cc) => cc.contact)
        .filter((contact): contact is Contact => !!contact && contact.is_active);

      if (!recipients.length) {
        await this.markJob(job, 'failed', 'No assigned contacts available for this campaign job');
        return;
      }

      const processed = await this.dispatchRecipients(job, recipients);
      await this.finaliseJob(job, processed);
    } catch (error) {
      this.logger.error(`Failed processing job ${job.jobId}`, error instanceof Error ? error.stack : error);
      await this.markJob(job, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async dispatchRecipients(
    job: CampaignJob,
    contacts: Contact[],
  ): Promise<{ total: number; successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const contact of contacts) {
      const phone = contact.phone;
      const queuedMessage = this.sentMessageRepo.create({
        campaignId: job.campaignId,
        campaignJobId: job.id,
        contactId: contact.id,
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

    if (contacts.length) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'sentCount', contacts.length);
    }
    if (successful) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'successCount', successful);
    }
    if (failed) {
      await this.campaignRepo.increment({ id: job.campaignId }, 'failedCount', failed);
    }

    return { total: contacts.length, successful, failed };
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

    if (job.batchIndex === job.totalBatches - 1 && job.status === 'completed') {
      await this.cleanupService.scheduleMediaCleanup({ campaignId: job.campaignId });
    }
  }

  private async markJob(job: CampaignJob, status: DispatchJobStatus, reason?: string): Promise<void> {
    job.status = status;
    job.finishedAt = new Date();
    job.error = reason ?? null;
    await this.campaignJobRepo.save(job);
  }

  private resolveRetentionMs(key: string, defaultDays: number): number {
    const raw = this.configService.get<string | number>(key);
    const days = raw !== undefined && raw !== null ? Number(raw) : defaultDays;
    return Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : defaultDays * 24 * 60 * 60 * 1000;
  }
}
