import { PartialType } from '@nestjs/mapped-types';
import { CreateVirtualNumberDto } from './create-virtual-number.dto';
import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { VirtualNumberQuality, VirtualNumberStatus } from '../enums';

export class UpdateVirtualNumberDto extends PartialType(CreateVirtualNumberDto) {
  @IsOptional()
  @IsEnum(VirtualNumberStatus)
  status?: VirtualNumberStatus;

  @IsOptional()
  @IsEnum(VirtualNumberQuality)
  qualityRating?: VirtualNumberQuality;

  @IsOptional()
  @IsNumber()
  messageCount24h?: number;

  @IsOptional()
  @IsDateString()
  lastUsedAt?: string;
}
