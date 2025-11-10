import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // Explicitly select the password column (mapped as passwordHash) even though it's select: false
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username: loginDto.username })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Add additional logging for debugging login issues
    console.log('Comparing passwords for user:', user.username);
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    console.log('Password validation result:', isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [
        { username: registerDto.username },
        { email: registerDto.email },
      ],
    });

    if (existingUser) {
      throw new UnauthorizedException('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      passwordHash,
      role: registerDto.role || 'user',
      credits: registerDto.credits || 0,
      status: registerDto.status || UserStatus.ACTIVE,
    });

    await this.userRepository.save(user);

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        credits: user.credits,
        status: user.status,
      },
      token,
    };
  }

  async verifyToken(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: parseInt(userId) } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: null,
    };
  }
}