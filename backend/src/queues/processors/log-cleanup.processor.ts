import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job } from 'bullmq';
import { SentMessage } from '../../dispatch/entities/sent-message.entity';
import { CampaignJob } from '../../dispatch/entities/campaign-job.entity';
import { LOG_CLEANUP_QUEUE } from '../queue.constants';
import { LogCleanupPayload } from '../cleanup.service';

@Processor(LOG_CLEANUP_QUEUE)
export class LogCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(LogCleanupProcessor.name);

  constructor(
    @InjectRepository(SentMessage)
    private readonly sentMessageRepo: Repository<SentMessage>,
    @InjectRepository(CampaignJob)
    private readonly campaignJobRepo: Repository<CampaignJob>,
  ) {
    super();
  }

  async process(job: Job<LogCleanupPayload>): Promise<void> {
    const cutoff = this.resolveCutoff(job.data.before, job.data.retentionMs);
    if (!cutoff) {
      this.logger.warn('Log cleanup skipped due to invalid or missing cutoff date');
      return;
    }

    const conditions: Record<string, any> = { queuedAt: LessThan(cutoff) };
    if (job.data.campaignId) {
      conditions.campaignId = job.data.campaignId;
    }

    const sentResult = await this.sentMessageRepo.delete(conditions);
    this.logger.log(
      `Deleted ${sentResult.affected ?? 0} sent_messages before ${cutoff.toISOString()}${
        job.data.campaignId ? ` for campaign ${job.data.campaignId}` : ''
      }`,
    );

    const jobConditions: Record<string, any> = { queuedAt: LessThan(cutoff) };
    if (job.data.campaignId) {
      jobConditions.campaignId = job.data.campaignId;
    }

    const campaignJobResult = await this.campaignJobRepo.delete(jobConditions);
    this.logger.log(
      `Deleted ${campaignJobResult.affected ?? 0} campaign_jobs before ${cutoff.toISOString()}${
        job.data.campaignId ? ` for campaign ${job.data.campaignId}` : ''
      }`,
    );
  }

  private resolveCutoff(before?: string, retentionMs?: number): Date | null {
    if (before) {
      const parsed = new Date(before);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (retentionMs && retentionMs > 0) {
      return new Date(Date.now() - retentionMs);
    }

    return null;
  }
}
