import { IsString, IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  credits?: number;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
