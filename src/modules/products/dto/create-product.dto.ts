import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockStatus?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ProductImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ProductVideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 'pcs' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customUnit?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'archived', 'deleted'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deletedBy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ description: 'Category slug from the existing frontend form.' })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  images?: Array<string | ProductImageDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  videos?: Array<string | ProductVideoDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  buyEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  seoKeywords?: string[];
}
