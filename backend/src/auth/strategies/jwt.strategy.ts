import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('User not found or has been removed.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException(
        'Your account has been deactivated by an administrator.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    return { id: user.id, username: user.username, role: user.role };
  }
}
