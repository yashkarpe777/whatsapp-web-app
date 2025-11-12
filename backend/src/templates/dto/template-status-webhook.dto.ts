import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProviderValidationStatus } from '../../campaigns/entities/message-template.entity';

export enum TemplateProvider {
  META = 'meta',
  DLT = 'dlt',
  BSP = 'bsp',
}

export class TemplateStatusWebhookDto {
  @IsEnum(TemplateProvider)
  provider: TemplateProvider;

  @IsEnum(ProviderValidationStatus)
  status: ProviderValidationStatus;

  @IsOptional()
  @IsString()
  providerTemplateId?: string;

  @IsOptional()
  @IsNumber()
  templateId?: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
