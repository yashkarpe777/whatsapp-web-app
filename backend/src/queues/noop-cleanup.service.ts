import { Injectable, Logger } from '@nestjs/common';
import { LogCleanupPayload, MediaCleanupPayload, RetryCleanupPayload } from './cleanup.service';

@Injectable()
export class NoopCleanupService {
  private readonly logger = new Logger(NoopCleanupService.name);

  async scheduleMediaCleanup(payload: MediaCleanupPayload, delayMs = 0) {
    this.logger.debug(
      `Queues disabled; skipping media cleanup for campaign ${payload.campaignId} (delay ${delayMs}ms).`,
    );
  }

  async scheduleLogCleanup(payload: LogCleanupPayload, delayMs = 0) {
    this.logger.debug(
      `Queues disabled; skipping log cleanup for campaign ${payload.campaignId ?? 'ALL'} (delay ${delayMs}ms).`,
    );
  }

  async scheduleRetryCleanup(payload: RetryCleanupPayload, delayMs = 0) {
    this.logger.debug(
      `Queues disabled; skipping retry cleanup for campaign ${payload.campaignId ?? 'ALL'} (delay ${delayMs}ms).`,
    );
  }
}
