import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }
}
