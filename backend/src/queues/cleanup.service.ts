import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  LOG_CLEANUP_JOB,
  LOG_CLEANUP_QUEUE,
  MEDIA_CLEANUP_JOB,
  MEDIA_CLEANUP_QUEUE,
  RETRY_CLEANUP_JOB,
  RETRY_CLEANUP_QUEUE,
} from './queue.constants';

export interface MediaCleanupPayload {
  campaignId: number;
  mediaPaths?: string[];
}

export interface LogCleanupPayload {
  campaignId?: number;
  before?: string;
  retentionMs?: number;
}

export interface RetryCleanupPayload {
  campaignId?: number;
  before?: string;
  retentionMs?: number;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectQueue(MEDIA_CLEANUP_QUEUE)
    private readonly mediaCleanupQueue: Queue,
    @InjectQueue(LOG_CLEANUP_QUEUE)
    private readonly logCleanupQueue: Queue,
    @InjectQueue(RETRY_CLEANUP_QUEUE)
    private readonly retryCleanupQueue: Queue,
  ) {}

  async scheduleMediaCleanup(payload: MediaCleanupPayload, delayMs = 0) {
    this.logger.debug(`Enqueue media cleanup for campaign ${payload.campaignId}`);
    await this.mediaCleanupQueue.add(MEDIA_CLEANUP_JOB, payload, { delay: delayMs });
  }

  async scheduleLogCleanup(payload: LogCleanupPayload, delayMs = 0) {
    this.logger.debug(`Enqueue log cleanup for campaign ${payload.campaignId ?? 'ALL'} before ${payload.before}`);
    await this.logCleanupQueue.add(LOG_CLEANUP_JOB, payload, { delay: delayMs });
  }

  async scheduleRetryCleanup(payload: RetryCleanupPayload, delayMs = 0) {
    this.logger.debug(
      `Enqueue retry cleanup for campaign ${payload.campaignId ?? 'ALL'} before ${payload.before ?? 'retention window'}`,
    );
    await this.retryCleanupQueue.add(RETRY_CLEANUP_JOB, payload, { delay: delayMs });
  }
}
