import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Campaign, CampaignContact } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create.campaign.dto';
import { UpdateCampaignDto } from './dto/update.campaign.dto';
import { RunCampaignDto } from './dto/run.campaign.dto';
import { User } from '../auth/entities/user.entity';
import { NumbersService } from '../numbers/numbers.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { VirtualNumberStatus } from '../numbers/enums';
import { EnqueueCampaignResult } from '../dispatch/types/dispatch-job';
import {
  MessageTemplate,
  TemplateApprovalStatus,
} from './entities/message-template.entity';
import { VirtualNumber } from '../numbers/entities/virtual-number.entity';
import {
  CampaignMediaValidationError,
  MEDIA_SIZE_LIMITS,
  ONE_MB,
  validateCampaignMediaSize,
} from './utils/media-validator';
import { CleanupService } from '../queues/cleanup.service';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignContact)
    private campaignContactRepo: Repository<CampaignContact>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(MessageTemplate)
    private templateRepo: Repository<MessageTemplate>,
    @InjectRepository(Contact)
    private contactRepo: Repository<Contact>,
    private readonly numbersService: NumbersService,
    private readonly dispatchService: DispatchService,
    private readonly dataSource: DataSource,
    private readonly cleanupService: CleanupService,
  ) {}

  async create(dto: CreateCampaignDto, user: User) {
    await this.ensureTemplateAvailability(dto.templateId);

    const {
      media_mime_type: mediaMimeType,
      media_size: mediaSize,
      ...campaignDto
    } = dto;

    try {
      validateCampaignMediaSize({
        mediaType: campaignDto.media_type,
        mediaUrl: campaignDto.media_url,
        mediaName: campaignDto.media_name,
        attachmentUrl: campaignDto.attachmentUrl,
        mimeType: mediaMimeType,
        mediaSize,
      });
    } catch (error) {
      if (error instanceof CampaignMediaValidationError) {
        const limitMb = (MEDIA_SIZE_LIMITS[error.mediaType] / ONE_MB).toFixed(2);
        throw new BadRequestException(
          `Uploaded ${error.mediaType} exceeds the maximum allowed size of ${limitMb} MB.`,
        );
      }

      throw error;
    }

    const campaign = this.campaignRepo.create({
      ...campaignDto,
      user,
      name: campaignDto.name ?? campaignDto.campaign_name,
      ctaButtons: campaignDto.ctaButtons ?? [],
      status: campaignDto.status ?? 'draft',
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

    const {
      media_mime_type: mediaMimeType,
      media_size: mediaSize,
      ...updateDto
    } = dto;

    try {
      const existing = await this.findOne(campaignId);

      if (updateDto.templateId) {
        await this.ensureTemplateAvailability(updateDto.templateId);
      }

      validateCampaignMediaSize({
        mediaType: updateDto.media_type ?? existing.media_type,
        mediaUrl: updateDto.media_url ?? existing.media_url,
        mediaName: updateDto.media_name ?? existing.media_name,
        attachmentUrl: updateDto.attachmentUrl ?? existing.attachmentUrl,
        mimeType: mediaMimeType,
        mediaSize,
      });

      const updateResult = await this.campaignRepo.update(campaignId, updateDto);
      
      if (updateResult.affected === 0) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      if (this.shouldTriggerImmediateCleanup(updateDto.status)) {
        await this.scheduleImmediateCleanup(campaignId);
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
      await this.scheduleImmediateCleanup(campaignId);
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

    const assignedNumber = await this.resolveVirtualNumber(dto.virtualNumberId);

    const shouldStartNow = dto.startImmediately !== false;
    const { savedCampaign, dispatchResult } = await this.dataSource.transaction(async (manager) => {
      const campaignRepo = manager.getRepository(Campaign);
      const userRepo = manager.getRepository(User);
      const campaignContactRepo = manager.getRepository(CampaignContact);

      const managedCampaign = await campaignRepo.findOne({
        where: { id: campaign.id, user: { id: user.id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!managedCampaign) {
        throw new NotFoundException(`Campaign ${campaign.id} not found for this user`);
      }

      const selectedContacts = await this.resolveTargetContacts(manager, user.id, dto);
      const recipientsCount = selectedContacts.length;

      if (recipientsCount <= 0) {
        throw new BadRequestException('No contacts available to run this campaign');
      }

      const account = await userRepo.findOne({ where: { id: user.id }, lock: { mode: 'pessimistic_write' } });
      if (!account) {
        throw new NotFoundException('User not found');
      }
      if (account.credits < recipientsCount) {
        throw new ForbiddenException(
          `You don't have enough credits to run this campaign. Contact admin for more credits. (Available: ${account.credits}, Required: ${recipientsCount})`,
        );
      }
      account.credits -= recipientsCount;
      await userRepo.save(account);

      managedCampaign.status = shouldStartNow ? 'running' : 'scheduled';
      managedCampaign.recipientsCount = recipientsCount;
      if (shouldStartNow) {
        managedCampaign.lastRunAt = new Date();
      }
      managedCampaign.sentCount = 0;
      managedCampaign.successCount = 0;
      managedCampaign.failedCount = 0;
      managedCampaign.readCount = 0;

      const saved = await campaignRepo.save(managedCampaign);

      await campaignContactRepo.delete({ campaignId: saved.id });
      await campaignContactRepo.save(
        selectedContacts.map((contact, index) =>
          campaignContactRepo.create({
            campaignId: saved.id,
            contactId: contact.id,
            sequence: index,
            jobId: null,
          }),
        ),
      );

      let dispatchMeta: EnqueueCampaignResult | null = null;
      let savedJobs: CampaignDispatchBatchWrapper | null = null;
      if (shouldStartNow) {
        const enqueueResult = await this.dispatchService.enqueueCampaign(
          {
            campaignId: saved.id,
            userId: user.id,
            recipientsCount,
            preferredNumberId: dto.virtualNumberId,
            enqueueReason: 'manual_run',
            assignedNumberId: assignedNumber.id,
            assignedNumberLabel: assignedNumber.phoneNumberId,
            businessNumberId: assignedNumber.businessNumber?.id,
            businessNumber:
              assignedNumber.businessNumber?.displayPhoneNumber ||
              assignedNumber.businessNumber?.businessName,
          },
          manager,
        );
        dispatchMeta = enqueueResult;
        savedJobs = {
          campaignId: saved.id,
          jobs: enqueueResult.batches.map((batch) => ({
            jobId: batch.id,
            batchIndex: batch.batchIndex,
            size: batch.size,
          })),
        };
      }

      if (savedJobs) {
        await this.assignContactsToJobs(manager, savedJobs, selectedContacts.length);
      }

      return {
        savedCampaign: saved,
        dispatchResult: dispatchMeta,
      };
    });

    return {
      campaign: savedCampaign,
      assignedNumber,
      dispatch: dispatchResult,
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

  private shouldTriggerImmediateCleanup(status?: string | null): boolean {
    if (!status) {
      return false;
    }

    const normalised = status.toLowerCase();
    return normalised === 'cancelled' || normalised === 'canceled';
  }

  private async scheduleImmediateCleanup(campaignId: number): Promise<void> {
    const cutoff = new Date().toISOString();
    try {
      await Promise.all([
        this.cleanupService.scheduleLogCleanup({ campaignId, before: cutoff }),
        this.cleanupService.scheduleRetryCleanup({ campaignId, before: cutoff }),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to schedule immediate cleanup for campaign ${campaignId}: ${(error as Error).message}`,
      );
    }
  }

  private async resolveTargetContacts(
    manager: EntityManager,
    userId: number,
    dto: RunCampaignDto,
  ): Promise<Contact[]> {
    const contactRepo = manager.getRepository(Contact);

    if (dto.contactIds && dto.contactIds.length > 0) {
      const uniqueIds = Array.from(new Set(dto.contactIds.map((id) => Number(id)))).filter((id) => !Number.isNaN(id));
      if (!uniqueIds.length) {
        throw new BadRequestException('contactIds must include at least one valid identifier');
      }

      const contacts = await contactRepo.find({
        where: {
          id: In(uniqueIds),
          user: { id: userId },
          is_active: true,
        },
      });

      const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
      const ordered = uniqueIds
        .map((id) => contactMap.get(id))
        .filter((contact): contact is Contact => !!contact);

      if (ordered.length !== uniqueIds.length) {
        const missing = uniqueIds.filter((id) => !contactMap.has(id));
        throw new NotFoundException(`Some contacts are missing or inactive: ${missing.join(', ')}`);
      }

      return ordered;
    }

    if (!dto.recipientsCount || dto.recipientsCount <= 0) {
      throw new BadRequestException('recipientsCount must be greater than zero');
    }

    const fallback = await contactRepo.find({
      where: { user: { id: userId }, is_active: true },
      order: { created_at: 'ASC' },
      take: dto.recipientsCount,
    });

    if (!fallback.length) {
      throw new NotFoundException('No active contacts available for this campaign');
    }

    return fallback;
  }

  private async assignContactsToJobs(
    manager: EntityManager,
    jobInfo: CampaignJobAssignment,
    totalContacts: number,
  ): Promise<void> {
    const campaignContactRepo = manager.getRepository(CampaignContact);
    const orderedJobs = [...jobInfo.jobs].sort((a, b) => a.batchIndex - b.batchIndex);

    let start = 0;
    for (const job of orderedJobs) {
      if (start >= totalContacts) {
        break;
      }

      const end = Math.min(start + job.size, totalContacts);
      await campaignContactRepo
        .createQueryBuilder()
        .update(CampaignContact)
        .set({ jobId: job.jobId })
        .where('campaign_id = :campaignId AND sequence >= :start AND sequence < :end', {
          campaignId: jobInfo.campaignId,
          start,
          end,
        })
        .execute();

      start = end;
    }
  }
}

interface CampaignJobAssignment {
  campaignId: number;
  jobs: CampaignJobAssignmentItem[];
}

interface CampaignJobAssignmentItem {
  jobId: string;
  batchIndex: number;
  size: number;
}

interface CampaignDispatchBatchWrapper {
  campaignId: number;
  jobs: CampaignJobAssignmentItem[];
}
