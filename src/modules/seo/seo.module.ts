import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SeoController } from './seo.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SeoController],
})
export class SeoModule {}