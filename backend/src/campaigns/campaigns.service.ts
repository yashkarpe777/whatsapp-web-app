import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create.campaign.dto';
import { UpdateCampaignDto } from './dto/update.campaign.dto';
import { RunCampaignDto } from './dto/run.campaign.dto';
import { User } from '../auth/entities/user.entity';
import { NumbersService } from '../numbers/numbers.service';
import { VirtualNumberStatus } from '../numbers/enums';
import {
  MessageTemplate,
  TemplateApprovalStatus,
} from './entities/message-template.entity';
import { VirtualNumber } from '../numbers/entities/virtual-number.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(MessageTemplate)
    private templateRepo: Repository<MessageTemplate>,
    private readonly numbersService: NumbersService,
  ) {}

  async create(dto: CreateCampaignDto, user: User) {
    await this.ensureTemplateAvailability(dto.templateId);

    const campaign = this.campaignRepo.create({
      ...dto,
      user,
      name: dto.name ?? dto.campaign_name,
      ctaButtons: dto.ctaButtons ?? [],
      status: dto.status ?? 'draft',
    });

    return this.campaignRepo.save(campaign);
  }

  async findAll(userId: number) {
    return this.campaignRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }
  
  async getRecent(userId: number, limit: number = 4) {
    return this.campaignRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
  
  async getDashboardStats(userId: number) {
    try {
      // Get active campaigns count
      const activeCampaignsCount = await this.campaignRepo.count({
        where: { user: { id: userId }, status: 'active' }
      });
      
      // Get total sent messages (this would be a more complex query in a real app)
      // For now, we'll return mock data
      const sentToday = '1,204';
      
      // Get delivery rate (also mock data for now)
      const deliveryRate = '98.7%';
      
      return {
        activeCampaigns: activeCampaignsCount,
        activeCampaignsTrend: { value: '+2% from last week', isPositive: true },
        sentToday,
        sentTodayTrend: { value: '+10% from yesterday', isPositive: true },
        deliveryRate,
        deliveryRateTrend: { value: '-0.2% from last week', isPositive: false },
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      // Return default stats on error
      return {
        activeCampaigns: 0,
        activeCampaignsTrend: { value: '0% change', isPositive: true },
        sentToday: '0',
        sentTodayTrend: { value: '0% change', isPositive: true },
        deliveryRate: '0%',
        deliveryRateTrend: { value: '0% change', isPositive: true },
      };
    }
  }

  async findOne(id: number | string) {
    // Validate the ID is a valid number
    const campaignId = Number(id);
    
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID: ${id}`);
    }
    
    try {
      const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
      if (!campaign) throw new NotFoundException(`Campaign with ID ${id} not found`);
      return campaign;
    } catch (error) {
      // If it's already a NotFoundException, rethrow it
      if (error instanceof NotFoundException) throw error;
      
      // Otherwise, log and throw a more specific error
      console.error(`Error finding campaign with ID ${id}:`, error);
      throw new NotFoundException(`Error retrieving campaign: ${error.message}`);
    }
  }

  async update(id: number | string, dto: UpdateCampaignDto) {
    // Validate the ID is a valid number
    const campaignId = Number(id);
    
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID: ${id}`);
    }

    if (dto.templateId) {
      await this.ensureTemplateAvailability(dto.templateId);
    }

    try {
      const updateResult = await this.campaignRepo.update(campaignId, dto);
      
      if (updateResult.affected === 0) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }
      
      return this.findOne(campaignId);
    } catch (error) {
      // If it's already a NotFoundException, rethrow it
      if (error instanceof NotFoundException) throw error;
      
      // Otherwise, log and throw a more specific error
      console.error(`Error updating campaign with ID ${id}:`, error);
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  }

  async remove(id: number | string) {
    // Validate the ID is a valid number
    const campaignId = Number(id);
    
    if (isNaN(campaignId)) {
      throw new NotFoundException(`Invalid campaign ID: ${id}`);
    }
    
    try {
      // First check if the campaign exists
      const campaign = await this.findOne(campaignId);
      
      // Then remove it
      await this.campaignRepo.remove(campaign);
      return { message: 'Campaign deleted successfully' };
    } catch (error) {
      // If it's already a NotFoundException, rethrow it
      if (error instanceof NotFoundException) throw error;
      
      // Otherwise, log and throw a more specific error
      console.error(`Error removing campaign with ID ${id}:`, error);
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  }

  async runCampaign(dto: RunCampaignDto, user: User) {
    const campaign = await this.getCampaignForUser(dto.campaignId, user.id);

    if (['running', 'completed'].includes(campaign.status)) {
      throw new BadRequestException('Campaign is already running or completed');
    }

    const recipientsCount = dto.recipientsCount;
    if (!recipientsCount || recipientsCount <= 0) {
      throw new BadRequestException('recipientsCount must be greater than zero');
    }

    await this.deductCredits(user.id, recipientsCount);

    const assignedNumber = await this.resolveVirtualNumber(dto.virtualNumberId);

    const shouldStartNow = dto.startImmediately !== false;

    campaign.status = shouldStartNow ? 'running' : 'scheduled';
    campaign.recipientsCount = recipientsCount;
    if (shouldStartNow) {
      campaign.lastRunAt = new Date();
    }
    campaign.sentCount = 0;
    campaign.successCount = 0;
    campaign.failedCount = 0;
    campaign.readCount = 0;

    const saved = await this.campaignRepo.save(campaign);

    if (shouldStartNow) {
      await this.numbersService.recordMessageUsage(assignedNumber.id, recipientsCount);
    }

    return {
      campaign: saved,
      assignedNumber,
    };
  }

  private async ensureTemplateAvailability(templateId?: number) {
    if (!templateId) return;

    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} does not exist`);
    }

    if (template.approvalStatus !== TemplateApprovalStatus.APPROVED) {
      throw new BadRequestException('Template must be approved before running campaigns');
    }
  }

  private async getCampaignForUser(campaignId: number, userId: number) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, user: { id: userId } },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found for this user`);
    }

    return campaign;
  }

  private async deductCredits(userId: number, amount: number) {
    const account = await this.userRepo.findOne({ where: { id: userId } });
    if (!account) {
      throw new NotFoundException('User not found');
    }

    if (account.credits < amount) {
      throw new ForbiddenException(
        `Insufficient credits. Available: ${account.credits}, required: ${amount}`,
      );
    }

    account.credits -= amount;
    await this.userRepo.save(account);

    return account;
  }

  private async resolveVirtualNumber(preferredId?: number): Promise<VirtualNumber> {
    const numbers = await this.numbersService.listVirtualNumbers();

    if (preferredId) {
      const specific = numbers.find((num) => num.id === preferredId);
      if (!specific) {
        throw new NotFoundException(`Virtual number ${preferredId} not found`);
      }
      if (specific.status !== VirtualNumberStatus.ACTIVE) {
        throw new BadRequestException('Selected virtual number is not active');
      }
      return specific;
    }

    const primaryActive = numbers.find(
      (num) => num.isPrimary && num.status === VirtualNumberStatus.ACTIVE,
    );
    if (primaryActive) {
      return primaryActive;
    }

    const switched = await this.numbersService.manualSwitch(undefined, {
      reason: 'Auto-switch triggered for campaign run',
    });

    if (!switched || switched.status !== VirtualNumberStatus.ACTIVE) {
      throw new BadRequestException('No active virtual number available to run campaign');
    }

    return switched;
  }
}
