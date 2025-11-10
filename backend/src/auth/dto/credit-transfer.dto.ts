import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CreditTransferDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  amount: number;
}
