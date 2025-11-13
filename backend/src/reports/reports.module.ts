import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { NumbersModule } from '../numbers/numbers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Campaign]), NumbersModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
