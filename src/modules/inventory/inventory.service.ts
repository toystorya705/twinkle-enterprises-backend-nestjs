import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.inventoryItem.findMany({
      include: { Product: true, Supplier: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
