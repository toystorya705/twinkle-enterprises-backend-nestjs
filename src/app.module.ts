import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EnquiryModule } from './modules/enquiries/enquiries.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProductsModule } from './modules/products/products.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ProductsModule,
    CategoriesModule,
    CustomersModule,
    ReviewsModule,
    EnquiryModule,
    QuotationsModule,
    InvoicesModule,
    InventoryModule,
    SuppliersModule,
    PaymentsModule,
    ReportsModule,
    DashboardModule,
    SettingsModule,
    UploadsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
