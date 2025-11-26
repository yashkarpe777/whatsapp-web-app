import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NumberRoutingMode } from '../enums';

export class UpdateBusinessNumberDto {
  @IsOptional()
  @IsString()
  businessName?: string;

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
  @IsBoolean()
  autoSwitchEnabled?: boolean;

  @IsOptional()
  @IsEnum(NumberRoutingMode)
  routingMode?: NumberRoutingMode;
}
