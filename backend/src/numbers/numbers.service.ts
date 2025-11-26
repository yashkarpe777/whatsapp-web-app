import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { VirtualNumber } from './entities/virtual-number.entity';
import { BusinessNumber } from './entities/business-number.entity';
import { CreateVirtualNumberDto } from './dto/create-virtual-number.dto';
import { UpdateVirtualNumberDto } from './dto/update-virtual-number.dto';
import { UpdateBusinessNumberDto } from './dto/update-business-number.dto';
import { NumberRoutingMode, VirtualNumberQuality, VirtualNumberStatus } from './enums';

type SwitchContext = {
  reason: string;
  forced?: boolean;
  excludeIds?: number[];
  maxMessageCount24h?: number;
  cooldownMinutes?: number;
  qualityWeights?: Partial<Record<VirtualNumberQuality, number>>;
};

type PickRandomActiveNumberOptions = {
  excludeIds?: number[];
  maxMessageCount24h?: number;
  cooldownMinutes?: number;
  qualityWeights?: Partial<Record<VirtualNumberQuality, number>>;
};

const DEFAULT_QUALITY_WEIGHTS: Record<VirtualNumberQuality, number> = {
  [VirtualNumberQuality.HIGH]: 5,
  [VirtualNumberQuality.MEDIUM]: 3,
  [VirtualNumberQuality.LOW]: 1,
  [VirtualNumberQuality.UNKNOWN]: 1,
};

@Injectable()
export class NumbersService {
  private readonly logger = new Logger(NumbersService.name);

  constructor(
    @InjectRepository(VirtualNumber)
    private readonly virtualRepo: Repository<VirtualNumber>,
    @InjectRepository(BusinessNumber)
    private readonly businessRepo: Repository<BusinessNumber>,
  ) {}

  async getBusinessNumber(): Promise<BusinessNumber | null> {
    return this.businessRepo.findOne({ where: {}, relations: { virtualNumbers: true } });
  }

  async upsertBusinessNumber(dto: UpdateBusinessNumberDto): Promise<BusinessNumber> {
    const existing = await this.getBusinessNumber();
    const entity = existing ? Object.assign(existing, dto) : this.businessRepo.create(dto);
    return this.businessRepo.save(entity);
  }

  async listVirtualNumbers(): Promise<VirtualNumber[]> {
    return this.virtualRepo.find({
      order: {
        isPrimary: 'DESC',
        status: 'ASC',
        qualityRating: 'ASC',
        messageCount24h: 'ASC',
        id: 'ASC',
      },
    });
  }

  async createVirtualNumber(dto: CreateVirtualNumberDto): Promise<VirtualNumber> {
    const entity = this.virtualRepo.create({
      businessNumber: dto.businessNumberId ? await this.getBusinessNumberById(dto.businessNumberId) : undefined,
      wabaId: dto.wabaId,
      phoneNumberId: dto.phoneNumberId,
      accessToken: dto.accessToken,
      status: dto.status || VirtualNumberStatus.ACTIVE,
      qualityRating: dto.qualityRating || VirtualNumberQuality.UNKNOWN,
      isPrimary: dto.isPrimary ?? true,
    });

    return this.virtualRepo.save(entity);
  }

  async updateVirtualNumber(id: number, dto: UpdateVirtualNumberDto): Promise<VirtualNumber> {
    const entity = await this.virtualRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Virtual number not found');

    if (dto.businessNumberId !== undefined) {
      entity.businessNumber = await this.getBusinessNumberById(dto.businessNumberId);
    }

    if (dto.isPrimary !== undefined) {
      entity.isPrimary = dto.isPrimary;
    }

    Object.assign(entity, dto);
    return this.virtualRepo.save(entity);
  }

  async removeVirtualNumber(id: number): Promise<{ success: boolean }> {
    const entity = await this.virtualRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Virtual number not found');
    }

    const businessNumber = await this.getBusinessNumber();
    if (businessNumber?.routingMode === NumberRoutingMode.VIRTUAL) {
      const remainingPrimaries = await this.virtualRepo.count({
        where: {
          id: Not(id),
          isPrimary: true,
          status: VirtualNumberStatus.ACTIVE,
        },
      });

      if (remainingPrimaries === 0) {
        this.logger.warn(`Deleting virtual number ${id} leaves no rotation-eligible numbers.`);
      }
    }

    await this.virtualRepo.remove(entity);
    return { success: true };
  }

  async manualSwitch(targetId?: number, context: SwitchContext = { reason: 'manual switch' }): Promise<VirtualNumber> {
    const businessNumber = await this.getBusinessNumber();
    if (businessNumber?.routingMode === NumberRoutingMode.BUSINESS) {
      throw new BadRequestException('Manual switch is disabled while routing mode is set to business number');
    }

    let target: VirtualNumber | null = null;

    if (targetId) {
      target = await this.virtualRepo.findOne({ where: { id: targetId } });
      if (!target) {
        throw new NotFoundException(`Target virtual number ${targetId} not found`);
      }
      if (target.status !== VirtualNumberStatus.ACTIVE) {
        throw new BadRequestException('Selected virtual number is not active');
      }

      if (!target.isPrimary) {
        if (context.forced) {
          target.isPrimary = true;
          await this.virtualRepo.save(target);
        } else {
          throw new BadRequestException('Selected virtual number is not rotation-enabled');
        }
      }

      await this.touchUsage(target.id);
      return target;
    }

    const selected = await this.selectRandomActiveNumber({
      excludeIds: context.excludeIds,
      maxMessageCount24h: context.maxMessageCount24h,
      cooldownMinutes: context.cooldownMinutes,
      qualityWeights: context.qualityWeights,
    });

    if (!selected) {
      throw new BadRequestException('No eligible virtual numbers found for switching');
    }

    return selected;
  }

  async recordMessageUsage(numberId: number, countIncrement = 1): Promise<void> {
    await this.virtualRepo.increment({ id: numberId }, 'messageCount24h', countIncrement);
    await this.virtualRepo.update({ id: numberId }, { lastUsedAt: new Date() });
  }

  async handleQualityUpdate(phoneNumberId: string, status?: VirtualNumberStatus, quality?: VirtualNumberQuality): Promise<VirtualNumber | null> {
    const entity = await this.virtualRepo.findOne({ where: { phoneNumberId } });
    if (!entity) {
      return null;
    }

    const previousQuality = entity.qualityRating;
    const previousStatus = entity.status;

    if (status) entity.status = status;
    if (quality) entity.qualityRating = quality;

    const qualityDegraded = quality && this.isQualityDowngrade(previousQuality, quality);
    const statusCritical = status && [VirtualNumberStatus.BANNED, VirtualNumberStatus.RESTRICTED, VirtualNumberStatus.THROTTLED].includes(status);

    if (statusCritical && entity.isPrimary) {
      entity.isPrimary = false;
    }

    await this.virtualRepo.save(entity);

    return entity;
  }

  private async getBusinessNumberById(id: number): Promise<BusinessNumber> {
    const businessNumber = await this.businessRepo.findOne({ where: { id } });
    if (!businessNumber) {
      throw new NotFoundException('Business number not found');
    }
    return businessNumber;
  }

  async selectRandomActiveNumber(options: PickRandomActiveNumberOptions = {}): Promise<VirtualNumber | null> {
    const businessNumber = await this.getBusinessNumber();
    if (businessNumber?.routingMode === NumberRoutingMode.BUSINESS) {
      this.logger.debug('Routing mode set to business number; skipping virtual number selection');
      return null;
    }

    const selected = await this.pickRandomActiveNumber(options);

    if (!selected) {
      return null;
    }

    await this.touchUsage(selected.id);
    return selected;
  }

  private async pickRandomActiveNumber(options: PickRandomActiveNumberOptions = {}): Promise<VirtualNumber | null> {
    let candidates = await this.virtualRepo.find({
      where: {
        status: VirtualNumberStatus.ACTIVE,
        isPrimary: true,
      },
    });

    if (!candidates.length) {
      candidates = await this.virtualRepo.find({
        where: {
          status: VirtualNumberStatus.ACTIVE,
        },
      });
    }

    if (!candidates.length) {
      return null;
    }

    const {
      excludeIds = [],
      maxMessageCount24h,
      cooldownMinutes,
      qualityWeights,
    } = options;

    const exclusionSet = new Set(excludeIds);
    const cooldownMs = cooldownMinutes ? cooldownMinutes * 60_000 : 0;
    const weights = { ...DEFAULT_QUALITY_WEIGHTS, ...qualityWeights };
    const now = Date.now();

    const filtered = candidates.filter((candidate) => {
      if (exclusionSet.has(candidate.id)) {
        return false;
      }

      if (maxMessageCount24h !== undefined && candidate.messageCount24h >= maxMessageCount24h) {
        return false;
      }

      if (cooldownMs && candidate.lastUsedAt) {
        const diff = now - candidate.lastUsedAt.getTime();
        if (diff < cooldownMs) {
          return false;
        }
      }

      return true;
    });

    const pool = filtered.length ? filtered : candidates;

    const weightedPool = pool.map((candidate) => {
      const qualityWeight = weights[candidate.qualityRating] ?? 1;
      let usageFactor = 1;

      if (maxMessageCount24h) {
        const utilisation = candidate.messageCount24h / maxMessageCount24h;
        usageFactor = Math.max(0.25, 1 - Math.min(utilisation, 0.9));
      }

      let cooldownMultiplier = 1;
      if (cooldownMs) {
        if (!candidate.lastUsedAt) {
          cooldownMultiplier = 1.5;
        } else {
          const diff = now - candidate.lastUsedAt.getTime();
          cooldownMultiplier = diff >= cooldownMs ? 1.5 : Math.max(0.5, diff / cooldownMs);
        }
      }

      const weight = qualityWeight * usageFactor * cooldownMultiplier;
      return {
        candidate,
        weight: Math.max(weight, 0.1),
      };
    });

    const totalWeight = weightedPool.reduce((acc, entry) => acc + entry.weight, 0);

    if (!totalWeight) {
      return weightedPool[0]?.candidate ?? null;
    }

    let threshold = Math.random() * totalWeight;
    for (const entry of weightedPool) {
      threshold -= entry.weight;
      if (threshold <= 0) {
        return entry.candidate;
      }
    }

    return weightedPool[weightedPool.length - 1]?.candidate ?? null;
  }

  private async touchUsage(id: number): Promise<void> {
    await this.virtualRepo.update({ id }, { lastUsedAt: new Date() });
  }

  private isQualityDowngrade(previous: VirtualNumberQuality, next: VirtualNumberQuality): boolean {
    const ranking: Record<VirtualNumberQuality, number> = {
      [VirtualNumberQuality.HIGH]: 3,
      [VirtualNumberQuality.MEDIUM]: 2,
      [VirtualNumberQuality.LOW]: 1,
      [VirtualNumberQuality.UNKNOWN]: 0,
    };

    return ranking[next] < ranking[previous];
  }
}
