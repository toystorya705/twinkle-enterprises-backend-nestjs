import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SkuService } from './sku.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, InventoryService, SkuService],
})
export class ProductsModule {}
