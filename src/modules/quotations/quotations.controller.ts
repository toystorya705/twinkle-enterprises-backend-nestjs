import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('Quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  findAll() {
    return this.quotations.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotations.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQuotationDto) {
    return this.quotations.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.quotations.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quotations.remove(id);
  }
}
