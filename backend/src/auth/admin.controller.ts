import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreditTransferDto } from './dto/credit-transfer.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get('users')
  async getAllUsers() {
    const users = await this.userRepository.find({
      select: ['id', 'username', 'email', 'role', 'credits', 'status', 'createdAt']
    });
    
    return users;
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    const user = await this.userRepository.findOne({ 
      where: { id: parseInt(id) },
      select: ['id', 'username', 'email', 'role', 'credits', 'status', 'createdAt']
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return user;
  }

  @Put('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    const user = await this.userRepository.findOne({ where: { id: parseInt(id) } });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    user.status = body.status as any;
    await this.userRepository.save(user);
    
    return {
      id: user.id,
      username: user.username,
      status: user.status,
      message: `User status updated to ${user.status}`
    };
  }

  @Post('credits/transfer')
  async transferCredits(
    @Body() creditTransferDto: CreditTransferDto,
    @Request() req
  ) {
    const { userId, amount } = creditTransferDto;
    
    // Find the target user
    const targetUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    // Update the user's credits
    targetUser.credits += amount;
    await this.userRepository.save(targetUser);
    
    return {
      userId: targetUser.id,
      username: targetUser.username,
      previousCredits: targetUser.credits - amount,
      currentCredits: targetUser.credits,
      transferAmount: amount,
      transferredBy: req.user.username
    };
  }

  @Get('credits')
  async getCreditsInfo() {
    const users = await this.userRepository.find({
      select: ['id', 'username', 'email', 'credits']
    });
    
    const totalCredits = users.reduce((sum, user) => sum + user.credits, 0);
    const userCount = users.length;
    
    return {
      totalCredits,
      userCount,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        credits: user.credits
      }))
    };
  }
}
