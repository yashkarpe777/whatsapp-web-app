import { Controller, Get, Put, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Controller('api/users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      credits: user.credits,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  @Put('update')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ 
      where: { id: req.user.id },
      select: ['id', 'username', 'email', 'passwordHash', 'role', 'credits', 'status']
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If updating password, verify current password
    if (updateUserDto.password) {
      if (!updateUserDto.currentPassword) {
        throw new UnauthorizedException('Current password is required to set a new password');
      }

      const isPasswordValid = await bcrypt.compare(
        updateUserDto.currentPassword,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Hash the new password
      user.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update username if provided
    if (updateUserDto.username) {
      // Check if username is already taken
      const existingUser = await this.userRepository.findOne({ 
        where: { username: updateUserDto.username } 
      });
      
      if (existingUser && existingUser.id !== user.id) {
        throw new UnauthorizedException('Username is already taken');
      }
      
      user.username = updateUserDto.username;
    }

    await this.userRepository.save(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      credits: user.credits,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
