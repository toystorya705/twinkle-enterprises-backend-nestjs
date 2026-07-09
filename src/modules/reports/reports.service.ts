import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary() {
    const [invoiceCount, sales] = await Promise.all([
      this.prisma.invoice.count(),
      this.prisma.invoice.aggregate({
        _sum: { subtotal: true, total: true },
      }),
    ]);

    return {
      invoiceCount,
      subtotal: sales._sum.subtotal ?? 0,
      total: sales._sum.total ?? 0,
    };
  }
}
