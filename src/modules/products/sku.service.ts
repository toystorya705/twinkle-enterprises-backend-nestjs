import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../shared/utils/slugify';

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) {}

  async nextProductSku(name?: string | null): Promise<string> {
    const prefix = this.prefix(name);
    const count = await this.prisma.product.count({
      where: {
        sku: {
          startsWith: `${prefix}-`,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  suggestVariantSku(productSku: string, variantName?: string | null, index = 1): string {
    const suffix = slugify(variantName || `VAR-${index}`).toUpperCase().replace(/-/g, '').slice(0, 8);
    return `${productSku}-${suffix || `V${index}`}`;
  }

  private prefix(name?: string | null): string {
    const base = slugify(name || 'product').replace(/-/g, '').toUpperCase();
    return (base || 'PRD').slice(0, 4).padEnd(4, 'X');
  }
}
