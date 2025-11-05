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

  async findOne(id: number) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(id: number, dto: UpdateCampaignDto) {
    await this.campaignRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const campaign = await this.findOne(id);
    await this.campaignRepo.remove(campaign);
    return { message: 'Deleted successfully' };
  }
}
