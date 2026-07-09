import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { EnquiryController } from './enquiries.controller';
import { EnquiryService } from './enquiries.service';

@Module({
  imports: [PrismaModule],
  controllers: [EnquiryController],
  providers: [EnquiryService],
  exports: [EnquiryService],
})
export class EnquiryModule {}
