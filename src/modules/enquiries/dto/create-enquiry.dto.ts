import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum EnquiryType {
  GENERAL = 'general',
  QUOTATION = 'quotation',
  SUPPORT = 'support',
}

export enum EnquiryStatus {
  NEW = 'new',
  PENDING = 'pending',
  CONTACTED = 'contacted',
  QUOTED = 'quoted',
  ANSWERED = 'answered',
  CLOSED = 'closed',
  SPAM = 'spam',
}

export class CreateEnquiryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    enum: EnquiryType,
    default: EnquiryType.GENERAL,
  })
  @IsOptional()
  @IsEnum(EnquiryType)
  enquiryType?: EnquiryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quotationId?: string;
}
