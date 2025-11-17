import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  contactIds?: number[];
}

export class DispatchJobSummaryDto {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  batchIndex: number;
  totalBatches: number;
  size: number;
  startedAt?: Date;
  finishedAt?: Date;
  attempt: number;
}

export class RunCampaignResponseDto {
  campaignId: number;
  assignedNumberId: number;
  totalBatches: number;
  batchSize: number;
  estimatedDurationSeconds: number;

  @IsArray()
  @Type(() => DispatchJobSummaryDto)
  jobs: DispatchJobSummaryDto[];
}
