import { Injectable } from '@nestjs/common';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

@Injectable()
export class InventoryService {
  stockStatus(quantity?: number | null, lowStockThreshold?: number | null): StockStatus {
    const qty = quantity ?? 0;
    if (qty <= 0) return 'out_of_stock';
    if (qty <= (lowStockThreshold ?? 5)) return 'low_stock';
    return 'in_stock';
  }
}
