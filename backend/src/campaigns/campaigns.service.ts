import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create.campaign.dto';
import { UpdateCampaignDto } from './dto/update.campaign.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
  ) {}

  async create(dto: CreateCampaignDto, user: User) {
    try {
      // Try to create with all fields
      const campaign = this.campaignRepo.create({ ...dto, user });
      return await this.campaignRepo.save(campaign);
    } catch (error) {
      // If error is about missing columns, use a more specific approach
      if (error.message && error.message.includes('media_type does not exist')) {
        // Create a new object with only the fields we know exist
        const safeDto = {
          campaign_name: dto.campaign_name,
          caption: dto.caption,
          media_url: dto.media_url,
          status: 'draft',
          scheduled_start: dto.scheduled_start,
          scheduled_end: dto.scheduled_end,
          user
        };
        
        const campaign = this.campaignRepo.create(safeDto);
        return await this.campaignRepo.save(campaign);
      }
      throw error;
    }
  }

  async findAll(userId: number) {
    try {
      // Try to fetch with all columns
      return await this.campaignRepo.find({ where: { user: { id: userId } }, order: { created_at: 'DESC' } });
    } catch (error) {
      // If error is about missing columns, use a more specific query
      if (error.message && error.message.includes('media_type does not exist')) {
        // Use a raw query to select only existing columns
        const campaigns = await this.campaignRepo.query(
          `SELECT c.id, c.campaign_name, c.caption, c.media_url, c.status, 
           c.scheduled_start, c.scheduled_end, c.created_at, c.user_id 
           FROM campaigns c WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
          [userId]
        );
        
        // Map to expected format
        return campaigns.map(c => ({
          id: c.id,
          campaign_name: c.campaign_name,
          caption: c.caption,
          media_url: c.media_url,
          status: c.status,
          scheduled_start: c.scheduled_start,
          scheduled_end: c.scheduled_end,
          created_at: c.created_at,
          user: { id: c.user_id }
        }));
      }
      throw error;
    }
  }
  
  async getRecent(userId: number, limit: number = 4) {
    try {
      // Try to fetch with all columns
      return await this.campaignRepo.find({ 
        where: { user: { id: userId } }, 
        order: { created_at: 'DESC' },
        take: limit
      });
    } catch (error) {
      // If error is about missing columns, use a more specific query
      if (error.message && error.message.includes('media_type does not exist')) {
        // Use a raw query to select only existing columns
        const campaigns = await this.campaignRepo.query(
          `SELECT c.id, c.campaign_name, c.caption, c.media_url, c.status, 
           c.scheduled_start, c.scheduled_end, c.created_at, c.user_id 
           FROM campaigns c WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT $2`,
          [userId, limit]
        );
        
        // Map to expected format
        return campaigns.map(c => ({
          id: c.id,
          campaign_name: c.campaign_name,
          caption: c.caption,
          media_url: c.media_url,
          status: c.status,
          scheduled_start: c.scheduled_start,
          scheduled_end: c.scheduled_end,
          created_at: c.created_at,
          user: { id: c.user_id }
        }));
      }
      throw error;
    }
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
}
