import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create.campaign.dto';
import { UpdateCampaignDto } from './dto/update.campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateCampaignDto, @Req() req) {
    return this.campaignsService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getDashboardStats(@Req() req) {
    try {
      return await this.campaignsService.getDashboardStats(req.user.id);
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
  
  @UseGuards(JwtAuthGuard)
  @Get('recent')
  async getRecent(@Req() req, @Query('limit') limitParam?: string) {
    try {
      // Parse limit parameter safely
      let limit = 4; // Default limit
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = parsedLimit;
        }
      }
      
      return await this.campaignsService.getRecent(req.user.id, limit);
    } catch (error) {
      console.error('Error getting recent campaigns:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req) {
    return this.campaignsService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.campaignsService.findOne(id);
    } catch (error) {
      console.error(`Controller error finding campaign ${id}:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    try {
      return await this.campaignsService.update(id, dto);
    } catch (error) {
      console.error(`Controller error updating campaign ${id}:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.campaignsService.remove(id);
    } catch (error) {
      console.error(`Controller error removing campaign ${id}:`, error);
      throw error;
    }
  }
}
