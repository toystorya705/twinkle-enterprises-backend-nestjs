import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReviewMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  file_url?: string;

  @ApiPropertyOptional({ enum: ['image', 'video'] })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiPropertyOptional({ enum: ['image', 'video'] })
  @IsOptional()
  @IsString()
  file_type?: string;
}

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [ReviewMediaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaDto)
  media?: ReviewMediaDto[];
}
