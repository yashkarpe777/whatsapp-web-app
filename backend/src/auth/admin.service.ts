import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { VirtualNumber } from '../numbers/entities/virtual-number.entity';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import { WebhookLogsService } from '../common/services/webhook-logs.service';

interface CampaignStats {
  activeCampaigns: number;
  scheduledCampaigns: number;
  totalCampaigns: number;
}

interface NumberHealthSummary {
  totalVirtualNumbers: number;
  statusBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
  primaryNumber?: {
    id: number;
    phoneNumberId: string;
    status: string;
    qualityRating: string;
    lastUsedAt: Date | null;
  } | null;
}

export interface AdminStatsResponse {
  totalUsers: number;
  totalCreditsAllocated: number;
  campaignStats: CampaignStats;
  numberHealth: NumberHealthSummary;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(VirtualNumber)
    private readonly virtualNumberRepository: Repository<VirtualNumber>,
    private readonly webhookLogsService: WebhookLogsService,
  ) {}

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'username', 'email', 'role', 'credits', 'status', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async setUserCredits(id: number, credits: number): Promise<User> {
    if (credits < 0) {
      throw new BadRequestException('Credits cannot be negative');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.credits = credits;
    return this.userRepository.save(user);
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'username', 'email', 'role', 'credits', 'status', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateUserStatus(id: number, status: UserStatus): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.status = status;
    return this.userRepository.save(user);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.remove(user);
  }

  async transferCredits(creditTransferDto: CreditTransferDto, transferredBy: string) {
    const { userId, amount } = creditTransferDto;

    if (!amount || amount === 0) {
      throw new BadRequestException('Transfer amount must be non-zero');
    }

    const targetUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const previousCredits = targetUser.credits;
    targetUser.credits += amount;

    await this.userRepository.save(targetUser);

    return {
      userId: targetUser.id,
      username: targetUser.username,
      previousCredits,
      currentCredits: targetUser.credits,
      transferAmount: amount,
      transferredBy,
    };
  }

  async deductCredits(creditTransferDto: CreditTransferDto, transferredBy: string) {
    const { userId, amount } = creditTransferDto;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Deduction amount must be greater than 0');
    }

    const targetUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if ((targetUser.credits ?? 0) < amount) {
      throw new BadRequestException('Insufficient credits to deduct');
    }

    const previousCredits = targetUser.credits;
    targetUser.credits -= amount;

    await this.userRepository.save(targetUser);

    return {
      userId: targetUser.id,
      username: targetUser.username,
      previousCredits,
      currentCredits: targetUser.credits,
      deductedAmount: amount,
      transferredBy,
    };
  }

  async getCreditsInfo() {
    const users = await this.userRepository.find({
      select: ['id', 'username', 'email', 'credits'],
      order: { username: 'ASC' },
    });

    const totalCredits = users.reduce((sum, user) => sum + (user.credits ?? 0), 0);

    return {
      totalCredits,
      userCount: users.length,
      users,
    };
  }

  async getStats(): Promise<AdminStatsResponse> {
    const [totalUsers, totalCredits, campaignStats, numberHealth] = await Promise.all([
      this.userRepository.count(),
      this.computeTotalCredits(),
      this.computeCampaignStats(),
      this.computeNumberHealth(),
    ]);

    return {
      totalUsers,
      totalCreditsAllocated: totalCredits,
      campaignStats,
      numberHealth,
    };
  }

  async getWebhookLogs(options?: { source?: string; limit?: number; eventType?: string }) {
    const logs = await this.webhookLogsService.findRecent({
      eventType: options?.eventType,
      limit: options?.limit,
    });

    return logs.map((log) => {
      const payload = log.payload ?? {};

      return {
        id: log.id,
        source: (payload as any)?.source ?? null,
        eventType: log.eventType ?? null,
        status: (payload as any)?.status ?? null,
        referenceId: (payload as any)?.referenceId ?? null,
        payload: (payload as any)?.data ?? payload ?? null,
        metadata: (payload as any)?.metadata ?? null,
        statusCode: log.statusCode ?? null,
        createdAt: log.receivedAt?.toISOString?.() ?? new Date().toISOString(),
      };
    });
  }

  private async computeTotalCredits(): Promise<number> {
    const raw = await this.userRepository
      .createQueryBuilder('user')
      .select('COALESCE(SUM(user.credits), 0)', 'total')
      .getRawOne<{ total: string }>();

    return raw?.total ? Number(raw.total) : 0;
  }

  private async computeCampaignStats(): Promise<CampaignStats> {
    const [totalCampaigns, activeCampaigns, scheduledCampaigns] = await Promise.all([
      this.campaignRepository.count(),
      this.campaignRepository.count({ where: { status: In(['running', 'active']) } }),
      this.campaignRepository.count({ where: { status: 'scheduled' } }),
    ]);

    return {
      totalCampaigns,
      activeCampaigns,
      scheduledCampaigns,
    };
  }

  private async computeNumberHealth(): Promise<NumberHealthSummary> {
    const [totalVirtualNumbers, statusRows, qualityRows, primaryNumber] = await Promise.all([
      this.virtualNumberRepository.count(),
      this.virtualNumberRepository
        .createQueryBuilder('virtual')
        .select('virtual.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('virtual.status')
        .getRawMany<{ status: string; count: string }>(),
      this.virtualNumberRepository
        .createQueryBuilder('virtual')
        .select('virtual.qualityRating', 'quality')
        .addSelect('COUNT(*)', 'count')
        .groupBy('virtual.qualityRating')
        .getRawMany<{ quality: string; count: string }>(),
      this.virtualNumberRepository.findOne({
        where: { isPrimary: true },
        select: ['id', 'phoneNumberId', 'status', 'qualityRating', 'lastUsedAt'],
      }),
    ]);

    const statusBreakdown = statusRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    const qualityBreakdown = qualityRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.quality] = Number(row.count);
      return acc;
    }, {});

    return {
      totalVirtualNumbers,
      statusBreakdown,
      qualityBreakdown,
      primaryNumber: primaryNumber
        ? {
            id: primaryNumber.id,
            phoneNumberId: primaryNumber.phoneNumberId,
            status: primaryNumber.status,
            qualityRating: primaryNumber.qualityRating,
            lastUsedAt: primaryNumber.lastUsedAt ?? null,
          }
        : null,
    };
  }
}
