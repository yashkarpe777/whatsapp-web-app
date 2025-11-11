import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { VirtualNumber } from './entities/virtual-number.entity';
import { BusinessNumber } from './entities/business-number.entity';
import { CreateVirtualNumberDto } from './dto/create-virtual-number.dto';
import { UpdateVirtualNumberDto } from './dto/update-virtual-number.dto';
import { UpdateBusinessNumberDto } from './dto/update-business-number.dto';
import { VirtualNumberQuality, VirtualNumberStatus } from './enums';

type SwitchContext = {
  reason: string;
  forced?: boolean;
};

@Injectable()
export class NumbersService {
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
    return this.virtualRepo.find({ order: { isPrimary: 'DESC', qualityRating: 'ASC', id: 'ASC' } });
  }

  async createVirtualNumber(dto: CreateVirtualNumberDto): Promise<VirtualNumber> {
    if (dto.isPrimary) {
      await this.clearPrimaryFlag();
    }

    const entity = this.virtualRepo.create({
      businessNumber: dto.businessNumberId ? await this.getBusinessNumberById(dto.businessNumberId) : undefined,
      wabaId: dto.wabaId,
      phoneNumberId: dto.phoneNumberId,
      accessToken: dto.accessToken,
      status: dto.status || VirtualNumberStatus.ACTIVE,
      qualityRating: dto.qualityRating || VirtualNumberQuality.UNKNOWN,
      isPrimary: dto.isPrimary || false,
    });

    return this.virtualRepo.save(entity);
  }

  async updateVirtualNumber(id: number, dto: UpdateVirtualNumberDto): Promise<VirtualNumber> {
    const entity = await this.virtualRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Virtual number not found');

    if (dto.isPrimary) {
      await this.clearPrimaryFlag();
    } else if (dto.isPrimary === false && entity.isPrimary) {
      throw new BadRequestException('At least one number must remain primary');
    }

    if (dto.businessNumberId !== undefined) {
      entity.businessNumber = await this.getBusinessNumberById(dto.businessNumberId);
    }

    Object.assign(entity, dto);
    return this.virtualRepo.save(entity);
  }

  async manualSwitch(targetId?: number, context: SwitchContext = { reason: 'manual switch' }): Promise<VirtualNumber> {
    let target: VirtualNumber | null = null;

    if (targetId) {
      target = await this.virtualRepo.findOne({ where: { id: targetId } });
      if (!target) {
        throw new NotFoundException(`Target virtual number ${targetId} not found`);
      }
    }

    if (!target) {
      target = await this.pickBestCandidate();
    }

    if (!target) {
      throw new BadRequestException('No eligible virtual numbers found for switching');
    }

    await this.clearPrimaryFlag();
    target.isPrimary = true;
    target.lastUsedAt = new Date();
    await this.virtualRepo.save(target);

    return target;
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

    await this.virtualRepo.save(entity);

    const qualityDegraded = quality && this.isQualityDowngrade(previousQuality, quality);
    const statusCritical = status && [VirtualNumberStatus.BANNED, VirtualNumberStatus.RESTRICTED, VirtualNumberStatus.THROTTLED].includes(status);

    if ((qualityDegraded || statusCritical) && entity.isPrimary) {
      await this.manualSwitch(undefined, {
        reason: `Auto switch triggered: ${qualityDegraded ? 'quality downgrade' : 'status change'}`,
      });
    }

    return entity;
  }

  private async getBusinessNumberById(id: number): Promise<BusinessNumber> {
    const businessNumber = await this.businessRepo.findOne({ where: { id } });
    if (!businessNumber) {
      throw new NotFoundException('Business number not found');
    }
    return businessNumber;
  }

  private async clearPrimaryFlag() {
    await this.virtualRepo.update({ isPrimary: true }, { isPrimary: false });
  }

  private async pickBestCandidate(): Promise<VirtualNumber | null> {
    const preferredOrder: VirtualNumberQuality[] = [
      VirtualNumberQuality.HIGH,
      VirtualNumberQuality.MEDIUM,
      VirtualNumberQuality.LOW,
      VirtualNumberQuality.UNKNOWN,
    ];

    for (const quality of preferredOrder) {
      const candidate = await this.virtualRepo.findOne({
        where: {
          status: VirtualNumberStatus.ACTIVE,
          qualityRating: quality,
        },
        order: { lastUsedAt: 'ASC', id: 'ASC' },
      });

      if (candidate) {
        return candidate;
      }
    }

    // fallback any active
    return this.virtualRepo.findOne({
      where: { status: VirtualNumberStatus.ACTIVE },
      order: { lastUsedAt: 'ASC', id: 'ASC' },
    });
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
