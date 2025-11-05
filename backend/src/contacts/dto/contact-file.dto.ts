import { IsNotEmpty, IsString } from 'class-validator';

export class ContactFileDto {
  @IsNotEmpty()
  @IsString()
  filename: string;
}
