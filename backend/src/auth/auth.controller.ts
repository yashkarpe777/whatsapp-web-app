import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // Public registration is limited to regular users
    const userDto = { ...registerDto, role: 'user' };
    return this.authService.register(userDto);
  }
  
  @Post('admin/register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async registerByAdmin(@Body() registerDto: RegisterDto, @Request() req) {
    console.log(`Admin ${req.user.username} creating new user`);
    return this.authService.register(registerDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  async verify(@Request() req) {
    console.log('Verify endpoint - User:', req.user);
    return this.authService.verifyToken(req.user.id);
  }
  
}