import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TemplatesService, ProviderSyncSummary } from './templates.service';

export interface TemplateSyncResult {
  summaries: ProviderSyncSummary[];
  triggeredAt: Date;
}

@Injectable()
export class TemplateSyncService {
  private readonly logger = new Logger(TemplateSyncService.name);

  constructor(private readonly templatesService: TemplatesService) {}

  async syncTemplates(triggeredBy: 'api' | 'schedule' = 'api'): Promise<TemplateSyncResult> {
    if (!this.templatesService.hasEnabledProviderClients()) {
      this.logger.debug('No provider clients enabled; skipping template sync.');
      return { summaries: [], triggeredAt: new Date() };
    }

    const summaries = await this.templatesService.syncFromProviders();

    const created = summaries.reduce((acc, summary) => acc + summary.created, 0);
    const updated = summaries.reduce((acc, summary) => acc + summary.updated, 0);

    this.logger.log(
      `Template sync completed via ${triggeredBy}. Providers: ${summaries.length}, created: ${created}, updated: ${updated}.`,
    );

    return { summaries, triggeredAt: new Date() };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async nightlySync() {
    try {
      const result = await this.syncTemplates('schedule');
      if (!result.summaries.length) {
        this.logger.debug('Nightly template sync found no providers or changes.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Nightly template sync failed: ${message}`, error instanceof Error ? error.stack : undefined);
    }
  }
}
