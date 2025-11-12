import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateValidationMode } from '../../campaigns/entities/message-template.entity';

class TemplateVariableDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsString()
  sampleValue?: string;
}

class TemplateSampleParameterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  value?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  @IsObject()
  ctaButton?: Record<string, any>;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSampleParameterDto)
  sampleParameters?: TemplateSampleParameterDto[];

  @IsOptional()
  @IsEnum(TemplateValidationMode)
  validationMode?: TemplateValidationMode;

  @IsOptional()
  @IsString()
  bspProvider?: string;
}
