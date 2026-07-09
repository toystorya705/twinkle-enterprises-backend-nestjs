import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export type BulkProductAction =
  | 'activate'
  | 'deactivate'
  | 'archive'
  | 'restore'
  | 'softDelete'
  | 'changeStatus';

export class BulkProductActionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({
    enum: ['activate', 'deactivate', 'archive', 'restore', 'softDelete', 'changeStatus'],
  })
  @IsString()
  @IsIn(['activate', 'deactivate', 'archive', 'restore', 'softDelete', 'changeStatus'])
  action!: BulkProductAction;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'archived', 'deleted'] })
  @IsOptional()
  @IsString()
  status?: string;
}
