import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';
import { VirtualNumberQuality, VirtualNumberStatus } from '../enums';

export class CreateVirtualNumberDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  businessNumberId?: number;

  @IsString()
  @IsNotEmpty()
  wabaId: string;

  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsOptional()
  @IsEnum(VirtualNumberStatus)
  status?: VirtualNumberStatus;

  @IsOptional()
  @IsEnum(VirtualNumberQuality)
  qualityRating?: VirtualNumberQuality;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
