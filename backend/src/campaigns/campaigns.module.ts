import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign } from './entities/campaign.entity';
import { MessageTemplate } from './entities/message-template.entity';
import { User } from '../auth/entities/user.entity';
import { NumbersModule } from '../numbers/numbers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, MessageTemplate, User]), NumbersModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
