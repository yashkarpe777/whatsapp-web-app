import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignCtaButtonDto {
  @IsEnum(['URL', 'PHONE', 'QUICK_REPLY'])
  type: 'URL' | 'PHONE' | 'QUICK_REPLY';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  payload?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  campaign_name: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  templateId?: number;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsString()
  media_type?: string;

  @IsOptional()
  @IsString()
  media_name?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  media_mime_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  media_size?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignCtaButtonDto)
  @ArrayMaxSize(3)
  @ArrayMinSize(0)
  ctaButtons?: CampaignCtaButtonDto[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  scheduled_start?: Date;

  @IsOptional()
  @IsDateString()
  scheduled_end?: Date;
}
