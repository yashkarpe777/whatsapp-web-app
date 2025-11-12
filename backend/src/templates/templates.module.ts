import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { MessageTemplate } from '../campaigns/entities/message-template.entity';
import { TemplatesController } from './templates.controller';
import { TemplatesWebhookController } from './templates.webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MessageTemplate])],
  controllers: [TemplatesController, TemplatesWebhookController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
