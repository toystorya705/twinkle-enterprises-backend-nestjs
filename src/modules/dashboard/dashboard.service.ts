import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      products,
      categories,
      customers,
      quotations,
      invoices,
      pendingReviews,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.category.count(),
      this.prisma.customer.count(),
      this.prisma.quotation.count(),
      this.prisma.invoice.count(),
      this.prisma.review.count({ where: { status: 'pending' } }),
    ]);

    const invoiceTotals = await this.prisma.invoice.aggregate({
      _sum: { total: true },
    });

    return {
      products,
      categories,
      customers,
      quotations,
      invoices,
      pendingReviews,
      revenue: invoiceTotals._sum.total ?? 0,
    };
  }
}
