import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookLog } from './entities/webhook-log.entity';
import { WebhookLogsService } from './services/webhook-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookLog])],
  providers: [WebhookLogsService],
  exports: [WebhookLogsService],
})
export class CommonModule {}
