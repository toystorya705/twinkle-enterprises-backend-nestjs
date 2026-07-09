import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { EnquiryStatus, EnquiryType } from './create-enquiry.dto';

export class EnquiryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EnquiryStatus })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @ApiPropertyOptional({ enum: EnquiryType })
  @IsOptional()
  @IsEnum(EnquiryType)
  enquiryType?: EnquiryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  limit?: string;
}