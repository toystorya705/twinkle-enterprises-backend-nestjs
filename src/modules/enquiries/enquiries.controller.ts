import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { EnquiryQueryDto } from './dto/enquiry-query.dto';
import { EnquiryService } from './enquiries.service';

@ApiTags('Enquiries')
@Controller('enquiries')
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  @Post()
  create(@Body() dto: CreateEnquiryDto) {
    return this.enquiryService.create(dto);
  }

  @Get()
  findAll(@Query() query: EnquiryQueryDto) {
    return this.enquiryService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enquiryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    return this.enquiryService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: Pick<UpdateEnquiryDto, 'status'>,
  ) {
    return this.enquiryService.update(id, { status: dto.status });
  }

  @Post(':id/quotation')
  convertToQuotation(@Param('id') id: string) {
    return this.enquiryService.convertToQuotation(id);
  }

  @Patch(':id/contacted')
  markContacted(@Param('id') id: string) {
    return this.enquiryService.markContacted(id);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.enquiryService.close(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enquiryService.remove(id);
  }
}
