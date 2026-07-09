import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {



  
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ enum: ['hotel', 'restaurant', 'catering', 'retail', 'other'] })
  @IsOptional()
  @IsString()
  businessType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ enum: ['lead', 'customer'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    enum: ['manual', 'website', 'whatsapp', 'facebook', 'instagram_api', 'quotation_enquiry'],
  })
  @IsOptional()
  @IsString()
  leadSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addedById?: string | null;
}
