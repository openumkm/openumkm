import { Module } from '@nestjs/common';
import { StorefrontController } from './controllers/storefront.controller';
import { AuthController } from './controllers/auth.controller';
import { AdminController } from './controllers/admin.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminAiController } from './controllers/admin-ai.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { SetupController } from './controllers/setup.controller';
import { HealthController } from './controllers/health.controller';
import { AuthService } from './services/auth.service';
import { SetupService } from './services/setup.service';
import { SettingsService } from './services/settings.service';
import { ProductService } from './services/product.service';
import { OrderService } from './services/order.service';
import { SessionService } from './services/session.service';
import { UploadService } from './services/upload.service';
import { AddressService } from './services/address.service';
import { EmailService } from './services/email.service';
import { AiService } from './services/ai.service';
import { ShippingService } from './services/shipping.service';
import { XenditService } from './services/xendit.service';

@Module({
  controllers: [
    HealthController,
    SetupController,
    StorefrontController,
    AuthController,
    DashboardController,
    AdminController,
    AdminProductsController,
    AdminOrdersController,
    AdminSettingsController,
    AdminAiController,
  ],
  providers: [
    AuthService,
    SetupService,
    SettingsService,
    ProductService,
    OrderService,
    SessionService,
    UploadService,
    AddressService,
    EmailService,
    AiService,
    ShippingService,
    XenditService,
  ],
})
export class AppModule {}
