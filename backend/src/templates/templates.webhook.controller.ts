import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplateStatusWebhookDto } from './dto/template-status-webhook.dto';

@Controller('api/webhooks')
export class TemplatesWebhookController {
  private readonly logger = new Logger(TemplatesWebhookController.name);

  constructor(private readonly templatesService: TemplatesService) {}

  @Post('template-status')
  @HttpCode(200)
  async handleTemplateStatus(@Body() dto: TemplateStatusWebhookDto) {
    const { updated } = await this.templatesService.handleProviderWebhook(dto);
    if (!updated) {
      this.logger.warn(`Template status webhook did not match any template: ${JSON.stringify(dto)}`);
    }
    return { received: true, updated };
  }
}
