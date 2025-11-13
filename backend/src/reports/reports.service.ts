import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { NumbersService } from '../numbers/numbers.service';
import { CampaignReportResponse } from './dto/campaign-report-response.dto';
import { VirtualNumber } from '../numbers/entities/virtual-number.entity';

export interface CampaignReportSummary {
  id: number;
  campaignId: number;
  campaignName: string;
  total: number;
  delivered: number;
  failed: number;
  read: number;
  readCount: number;
  deliveryRate: number;
  failureRate: number;
  lastUpdated: string;
}

export interface CampaignReportsOverview {
  totals: {
    total: number;
    delivered: number;
    failed: number;
    read: number;
    deliveryRate: number;
    failureRate: number;
  };
  campaigns: CampaignReportSummary[];
}

export interface NumbersReportResponse {
  totalNumbers: number;
  activeNumbers: number;
  statusBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
  numbers: Array<{
    id: number;
    phoneNumberId: string;
    status: string;
    qualityRating: string;
    messageCount24h: number;
    lastUsedAt: string | null;
    isPrimary: boolean;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly numbersService: NumbersService,
  ) {}

  async getCampaignReport(campaignId: number, userId: number): Promise<CampaignReportResponse> {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId, user: { id: userId } } });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found for this user`);
    }

    const report = await this.reportRepository.findOne({
      where: { campaignId },
      order: { lastUpdated: 'DESC' },
    });

    if (!report) {
      throw new NotFoundException(`No report available for campaign ${campaign.campaign_name}`);
    }

    const deliveryRate = report.total > 0 ? report.delivered / report.total : 0;
    const failureRate = report.total > 0 ? report.failed / report.total : 0;

    return {
      id: report.id,
      campaignId: report.campaignId,
      campaignName: campaign.campaign_name,
      total: report.total,
      delivered: report.delivered,
      failed: report.failed,
      read: report.read,
      readCount: report.readCount,
      createdAt: report.createdAt.toISOString(),
      lastUpdated: report.lastUpdated.toISOString(),
      deliveryRate: Number((deliveryRate * 100).toFixed(2)),
      failureRate: Number((failureRate * 100).toFixed(2)),
    };
  }

  async getCampaignReportsOverview(userId: number): Promise<CampaignReportsOverview> {
    const reports = await this.reportRepository.find({
      where: { campaign: { user: { id: userId } } },
      relations: { campaign: true },
      order: { lastUpdated: 'DESC' },
    });

    const latestReports = new Map<number, Report>();

    for (const report of reports) {
      const existing = latestReports.get(report.campaignId);
      if (!existing || existing.lastUpdated < report.lastUpdated) {
        latestReports.set(report.campaignId, report);
      }
    }

    const summaries: CampaignReportSummary[] = Array.from(latestReports.values()).map((report) => {
      const deliveryRate = report.total > 0 ? report.delivered / report.total : 0;
      const failureRate = report.total > 0 ? report.failed / report.total : 0;

      return {
        id: report.id,
        campaignId: report.campaignId,
        campaignName: report.campaign?.campaign_name || `Campaign ${report.campaignId}`,
        total: report.total,
        delivered: report.delivered,
        failed: report.failed,
        read: report.read,
        readCount: report.readCount,
        deliveryRate: Number((deliveryRate * 100).toFixed(2)),
        failureRate: Number((failureRate * 100).toFixed(2)),
        lastUpdated: report.lastUpdated.toISOString(),
      };
    });

    const aggregate = summaries.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.delivered += item.delivered;
        acc.failed += item.failed;
        acc.read += item.read;
        return acc;
      },
      { total: 0, delivered: 0, failed: 0, read: 0 },
    );

    const deliveryRate = aggregate.total > 0 ? (aggregate.delivered / aggregate.total) * 100 : 0;
    const failureRate = aggregate.total > 0 ? (aggregate.failed / aggregate.total) * 100 : 0;

    return {
      totals: {
        total: aggregate.total,
        delivered: aggregate.delivered,
        failed: aggregate.failed,
        read: aggregate.read,
        deliveryRate: Number(deliveryRate.toFixed(2)),
        failureRate: Number(failureRate.toFixed(2)),
      },
      campaigns: summaries,
    };
  }

  async getNumbersReport(): Promise<NumbersReportResponse> {
    const numbers: VirtualNumber[] = await this.numbersService.listVirtualNumbers();

    const statusBreakdown = numbers.reduce<Record<string, number>>((acc, number) => {
      acc[number.status] = (acc[number.status] || 0) + 1;
      return acc;
    }, {});

    const qualityBreakdown = numbers.reduce<Record<string, number>>((acc, number) => {
      acc[number.qualityRating] = (acc[number.qualityRating] || 0) + 1;
      return acc;
    }, {});

    return {
      totalNumbers: numbers.length,
      activeNumbers: numbers.filter((num) => num.status === 'active').length,
      statusBreakdown,
      qualityBreakdown,
      numbers: numbers.map((num) => ({
        id: num.id,
        phoneNumberId: num.phoneNumberId,
        status: num.status,
        qualityRating: num.qualityRating,
        messageCount24h: num.messageCount24h,
        lastUsedAt: num.lastUsedAt ? num.lastUsedAt.toISOString() : null,
        isPrimary: num.isPrimary,
      })),
    };
  }
}
