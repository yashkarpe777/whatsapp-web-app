import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { VirtualNumber } from '../numbers/entities/virtual-number.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Campaign, VirtualNumber]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get('JWT_EXPIRES_IN') || '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
    CommonModule,
  ],
  controllers: [AuthController, UsersController, AdminController],
  providers: [AuthService, JwtStrategy, RolesGuard, AdminService],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}