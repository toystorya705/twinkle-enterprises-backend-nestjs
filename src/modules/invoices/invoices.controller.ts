import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoices.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Patch(':id')
  cancel(@Param('id') id: string) {
    return this.invoices.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoices.remove(id);
  }
}
