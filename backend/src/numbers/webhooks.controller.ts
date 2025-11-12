import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { NumbersService } from './numbers.service';
import { VirtualNumberQuality, VirtualNumberStatus } from './enums';
import { WebhookLogsService } from '../common/services/webhook-logs.service';

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: any;
    }>;
  }>;
}

@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly numbersService: NumbersService,
    private readonly webhookLogsService: WebhookLogsService,
  ) {}

  @Post('meta')
  @HttpCode(200)
  async handleMetaWebhook(@Body() payload: MetaWebhookPayload) {
    if (!payload?.entry) {
      this.logger.warn('Received Meta webhook with no entries');
      return { received: true };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        await this.processChange(change?.field, change?.value);
      }
    }

    return { received: true };
  }

  private async processChange(field?: string, value?: any) {
    if (!value) return;

    const phoneNumberId =
      value?.metadata?.phone_number_id ?? value?.phone_number_id ?? value?.id ?? value?.recipient_id;

    if (!phoneNumberId) {
      this.logger.debug('Skipping webhook change without phone_number_id');
      return;
    }

    let status: VirtualNumberStatus | undefined;
    let quality: VirtualNumberQuality | undefined;

    if (field === 'quality_update' || value?.quality_rating) {
      quality = this.mapQuality(value.quality_rating ?? value?.current_limit?.quality_rating);
    }

    if (value?.event === 'RESTRICTED' || value?.messaging_product_status) {
      status = this.mapStatus(value?.event ?? value?.messaging_product_status);
    }

    if (value?.number_status) {
      status = this.mapStatus(value.number_status);
    }

    if (value?.statuses && Array.isArray(value.statuses)) {
      const latest = value.statuses[0];
      if (latest?.status) {
        status = this.mapStatus(latest.status);
      }
      if (latest?.quality) {
        quality = this.mapQuality(latest.quality);
      }
    }

    if (!status && !quality) {
      this.logger.debug(`No actionable status/quality change detected for ${phoneNumberId}`);
      return;
    }

    const updatedNumber = await this.numbersService.handleQualityUpdate(phoneNumberId, status, quality);

    await this.webhookLogsService.createLog({
      eventType: field ?? value?.event ?? 'update',
      payload: {
        source: 'meta_numbers',
        referenceId: phoneNumberId,
        status: status ?? quality ?? null,
        data: value,
        metadata: {
          processedAt: new Date().toISOString(),
          appliedStatus: status ?? null,
          appliedQuality: quality ?? null,
          isPrimary: updatedNumber?.isPrimary ?? null,
        },
      },
      statusCode: value?.status_code ?? null,
    });
  }

  private mapStatus(input?: string): VirtualNumberStatus | undefined {
    if (!input) return undefined;

    const normalized = input.toLowerCase();

    switch (normalized) {
      case 'restricted':
      case 'temporarily restricted':
        return VirtualNumberStatus.RESTRICTED;
      case 'throttled':
      case 'rate_limited':
        return VirtualNumberStatus.THROTTLED;
      case 'banned':
      case 'blocked':
        return VirtualNumberStatus.BANNED;
      case 'disconnected':
        return VirtualNumberStatus.DISCONNECTED;
      case 'active':
      case 'live':
      case 'ok':
        return VirtualNumberStatus.ACTIVE;
      default:
        return undefined;
    }
  }

  private mapQuality(input?: string): VirtualNumberQuality | undefined {
    if (!input) return undefined;

    const normalized = input.toLowerCase();

    switch (normalized) {
      case 'green':
      case 'high':
        return VirtualNumberQuality.HIGH;
      case 'yellow':
      case 'medium':
        return VirtualNumberQuality.MEDIUM;
      case 'red':
      case 'low':
        return VirtualNumberQuality.LOW;
      default:
        return VirtualNumberQuality.UNKNOWN;
    }
  }
}
