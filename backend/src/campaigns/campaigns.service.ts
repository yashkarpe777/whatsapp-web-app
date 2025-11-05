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
    const campaign = this.campaignRepo.create({ ...dto, user });
    return this.campaignRepo.save(campaign);
  }

  async findAll(userId: number) {
    return this.campaignRepo.find({ where: { user: { id: userId } }, order: { created_at: 'DESC' } });
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
