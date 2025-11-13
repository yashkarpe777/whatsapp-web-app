import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('campaign/:id')
  async getCampaignReport(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.reportsService.getCampaignReport(id, req.user.id);
  }

  @Get('campaign')
  async getCampaignReportsOverview(@Req() req) {
    return this.reportsService.getCampaignReportsOverview(req.user.id);
  }

  @Get('numbers')
  async getNumbersReport() {
    return this.reportsService.getNumbersReport();
  }
}
