import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  ProviderValidationStatus,
  TemplateValidationMode,
} from '../../campaigns/entities/message-template.entity';

export class UpdateTemplateStatusDto {
  @IsOptional()
  @IsEnum(ProviderValidationStatus)
  metaStatus?: ProviderValidationStatus;

  @IsOptional()
  @IsString()
  metaRejectionReason?: string | null;

  @IsOptional()
  @IsString()
  metaTemplateId?: string | null;

  @IsOptional()
  @IsEnum(ProviderValidationStatus)
  dltStatus?: ProviderValidationStatus;

  @IsOptional()
  @IsString()
  dltRejectionReason?: string | null;

  @IsOptional()
  @IsString()
  dltTemplateId?: string | null;

  @IsOptional()
  @IsEnum(ProviderValidationStatus)
  bspStatus?: ProviderValidationStatus;

  @IsOptional()
  @IsString()
  bspRejectionReason?: string | null;

  @IsOptional()
  @IsString()
  bspTemplateId?: string | null;

  @IsOptional()
  @IsString()
  bspProvider?: string | null;

  @IsOptional()
  @IsEnum(TemplateValidationMode)
  validationMode?: TemplateValidationMode;
}
