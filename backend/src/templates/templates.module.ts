import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TemplatesService } from './templates.service';
import { MessageTemplate } from '../campaigns/entities/message-template.entity';
import { TemplatesController } from './templates.controller';
import { TemplatesWebhookController } from './templates.webhook.controller';
import { MetaTemplateProviderClient } from './providers/meta-template.provider';
import { TEMPLATE_PROVIDER_CLIENTS } from './providers/template-provider.types';
import { TemplateSyncService } from './template-sync.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([MessageTemplate])],
  controllers: [TemplatesController, TemplatesWebhookController],
  providers: [
    TemplatesService,
    TemplateSyncService,
    MetaTemplateProviderClient,
    {
      provide: TEMPLATE_PROVIDER_CLIENTS,
      useFactory: (metaClient: MetaTemplateProviderClient) => [metaClient],
      inject: [MetaTemplateProviderClient],
    },
  ],
  exports: [TemplatesService],
})
export class TemplatesModule {}
