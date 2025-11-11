import { IsOptional, IsNumber } from 'class-validator';

export class ManualSwitchDto {
  @IsOptional()
  @IsNumber()
  targetId?: number;
}
