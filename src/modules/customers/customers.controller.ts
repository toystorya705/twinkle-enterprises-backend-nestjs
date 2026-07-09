import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  findAll() {
    return this.customers.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Patch('bulk')
  bulkAction(@Body() dto: { ids?: string[]; action?: string; status?: string }) {
    return this.customers.bulkAction(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }
}
