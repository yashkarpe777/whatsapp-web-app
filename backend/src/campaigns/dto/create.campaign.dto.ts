import { IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  campaign_name: string;

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
  @IsDateString()
  scheduled_start?: Date;

  @IsOptional()
  @IsDateString()
  scheduled_end?: Date;
}
