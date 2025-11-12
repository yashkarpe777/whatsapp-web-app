import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create.campaign.dto';
import { UpdateCampaignDto } from './dto/update.campaign.dto';
import { RunCampaignDto } from './dto/run.campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post('create')
  create(@Body() dto: CreateCampaignDto, @Req() req) {
    return this.campaignsService.create(dto, req.user);
  }

  @Post('run')
  runCampaign(@Body() dto: RunCampaignDto, @Req() req) {
    return this.campaignsService.runCampaign(dto, req.user);
  }

  @Get()
  findAll(@Req() req) {
    return this.campaignsService.findAll(req.user.id);
  }

  @Get('active-campaigns')
  async getActiveCampaigns(@Req() req) {
    return this.campaignsService.findAll(req.user.id);
  }

  @Get('stats')
  getDashboardStats(@Req() req) {
    return this.campaignsService.getDashboardStats(req.user.id);
  }

  @Get('recent')
  getRecent(@Req() req, @Query('limit') limitParam?: string) {
    let limit = 4;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    return this.campaignsService.getRecent(req.user.id, limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.findOne(id);
  }

  @Put(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }
}
