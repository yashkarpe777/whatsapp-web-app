import { IsBoolean, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class RunCampaignDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  campaignId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  virtualNumberId?: number;

  @IsInt()
  @Min(1)
  recipientsCount: number;

  @IsOptional()
  @IsBoolean()
  startImmediately?: boolean;
}
