import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { NumbersModule } from '../numbers/numbers.module';
import { CampaignJob } from './entities/campaign-job.entity';
import { SentMessage } from './entities/sent-message.entity';
import { DispatchWorker } from './dispatch.worker';
import { MockWhatsAppAdapter, WHATSAPP_ADAPTER } from './adapters/whatsapp.adapter';
import { Contact } from '../contacts/entities/contact.entity';
import { Campaign, CampaignContact } from '../campaigns/entities/campaign.entity';
import { CleanupModule } from '../queues/cleanup.module';

@Module({
  imports: [
    NumbersModule,
    CleanupModule,
    TypeOrmModule.forFeature([CampaignJob, SentMessage, Contact, Campaign, CampaignContact]),
  ],
  providers: [
    DispatchService,
    DispatchWorker,
    {
      provide: WHATSAPP_ADAPTER,
      useClass: MockWhatsAppAdapter,
    },
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
