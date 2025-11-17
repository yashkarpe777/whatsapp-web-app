import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MEDIA_CLEANUP_QUEUE, LOG_CLEANUP_QUEUE, RETRY_CLEANUP_QUEUE } from './queue.constants';
import { CleanupService } from './cleanup.service';
import { MediaCleanupProcessor } from './processors/media-cleanup.processor';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { SentMessage } from '../dispatch/entities/sent-message.entity';
import { CampaignJob } from '../dispatch/entities/campaign-job.entity';
import { LogCleanupProcessor } from './processors/log-cleanup.processor';
import { RetryCleanupProcessor } from './processors/retry-cleanup.processor';
import { CleanupScheduler } from './cleanup.scheduler';
import { ConfigModule } from '@nestjs/config';
import { NoopCleanupService } from './noop-cleanup.service';

const queuesEnabled = process.env.ENABLE_QUEUES === 'true';

const moduleImports = [
  ConfigModule,
  ...(queuesEnabled
    ? [
        BullModule.registerQueue(
          { name: MEDIA_CLEANUP_QUEUE },
          { name: LOG_CLEANUP_QUEUE },
          { name: RETRY_CLEANUP_QUEUE },
        ),
        TypeOrmModule.forFeature([Campaign, SentMessage, CampaignJob]),
      ]
    : []),
];

const moduleProviders = queuesEnabled
  ? [CleanupService, MediaCleanupProcessor, LogCleanupProcessor, RetryCleanupProcessor, CleanupScheduler]
  : [
      {
        provide: CleanupService,
        useClass: NoopCleanupService,
      },
    ];

const moduleExports = [CleanupService];

@Module({
  imports: moduleImports,
  providers: moduleProviders,
  exports: moduleExports,
})
export class CleanupModule {}
