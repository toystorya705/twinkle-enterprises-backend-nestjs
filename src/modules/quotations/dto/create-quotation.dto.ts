import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class QuotationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string | null;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;
}

export class CreateQuotationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerCity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerCountry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerMessage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gstPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gstAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdById?: string | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiProperty({ type: [QuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items!: QuotationItemDto[];
}
