import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.payment.findMany({
      include: { Customer: true, Invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
