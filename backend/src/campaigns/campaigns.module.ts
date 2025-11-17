import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign, CampaignContact } from './entities/campaign.entity';
import { MessageTemplate } from './entities/message-template.entity';
import { User } from '../auth/entities/user.entity';
import { NumbersModule } from '../numbers/numbers.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { CleanupModule } from '../queues/cleanup.module';
import { Contact } from '../contacts/entities/contact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignContact, MessageTemplate, User, Contact]),
    NumbersModule,
    DispatchModule,
    CleanupModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
