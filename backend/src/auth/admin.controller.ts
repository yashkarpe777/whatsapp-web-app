import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import { AdminService } from './admin.service';
import { UserStatus } from './entities/user.entity';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/status')
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: UserStatus }
  ) {
    return {
      user: await this.adminService.updateUserStatus(id, body.status),
      message: `User status updated to ${body.status}`,
    };
  }

  @Post('credits/transfer')
  async transferCredits(
    @Body() creditTransferDto: CreditTransferDto,
    @Request() req
  ) {
    return this.adminService.transferCredits(creditTransferDto, req.user.username);
  }

  @Post('credits/deduct')
  async deductCredits(
    @Body() creditTransferDto: CreditTransferDto,
    @Request() req
  ) {
    return this.adminService.deductCredits(creditTransferDto, req.user.username);
  }

  @Put('users/:id/credits')
  async setUserCredits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { credits: number }
  ) {
    return this.adminService.setUserCredits(id, body.credits);
  }

  @Get('credits')
  async getCreditsInfo() {
    return this.adminService.getCreditsInfo();
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('logs')
  async getLogs(
    @Query('source') source?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limitParam?: string,
  ) {
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 200) : undefined;
    return this.adminService.getWebhookLogs({ source, eventType, limit });
  }
}
