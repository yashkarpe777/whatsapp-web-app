import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job } from 'bullmq';
import { SentMessage } from '../../dispatch/entities/sent-message.entity';
import { RETRY_CLEANUP_QUEUE } from '../queue.constants';
import { RetryCleanupPayload } from '../cleanup.service';

@Processor(RETRY_CLEANUP_QUEUE)
export class RetryCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(RetryCleanupProcessor.name);

  constructor(
    @InjectRepository(SentMessage)
    private readonly sentMessageRepo: Repository<SentMessage>,
  ) {
    super();
  }

  async process(job: Job<RetryCleanupPayload>): Promise<void> {
    const cutoff = this.parseBefore(job.data.before);
    if (!cutoff) {
      this.logger.warn('Retry cleanup skipped due to invalid or missing cutoff date');
      return;
    }

    const conditions: Record<string, any> = {
      status: 'failed',
      queuedAt: LessThan(cutoff),
    };

    if (job.data.campaignId) {
      conditions.campaignId = job.data.campaignId;
    }

    const result = await this.sentMessageRepo.delete(conditions);
    this.logger.log(
      `Deleted ${result.affected ?? 0} failed sent_messages queued before ${cutoff.toISOString()}${
        job.data.campaignId ? ` for campaign ${job.data.campaignId}` : ''
      }`,
    );
  }

  private parseBefore(before?: string): Date | null {
    if (!before) {
      return null;
    }

    const parsed = new Date(before);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
