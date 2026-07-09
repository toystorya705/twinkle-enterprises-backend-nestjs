import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class InvoiceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gstPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

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
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cgst?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sgst?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}
