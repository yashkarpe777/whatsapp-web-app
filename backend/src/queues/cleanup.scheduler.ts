import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CleanupService } from './cleanup.service';

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(private readonly cleanupService: CleanupService, private readonly configService: ConfigService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scheduleDailyCleanups() {
    const logRetentionDays = this.getNumberEnv('LOG_RETENTION_DAYS', 30);
    const retryRetentionDays = this.getNumberEnv('RETRY_RETENTION_DAYS', 7);

    const now = Date.now();
    const logCutoff = new Date(now - logRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    const retryCutoff = new Date(now - retryRetentionDays * 24 * 60 * 60 * 1000).toISOString();

    this.logger.debug(`Scheduling log cleanup with cutoff ${logCutoff}`);
    await this.cleanupService.scheduleLogCleanup({ before: logCutoff });

    this.logger.debug(`Scheduling retry cleanup with cutoff ${retryCutoff}`);
    await this.cleanupService.scheduleRetryCleanup({ before: retryCutoff });
  }

  private getNumberEnv(key: string, fallback: number): number {
    const raw = this.configService.get<string | number>(key);
    if (raw === undefined || raw === null) {
      return fallback;
    }

    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
