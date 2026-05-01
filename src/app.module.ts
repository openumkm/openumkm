import { Module } from '@nestjs/common';
import { StorefrontController } from './controllers/storefront.controller';
import { CartController } from './controllers/cart.controller';
import { CheckoutController } from './controllers/checkout.controller';
import { PaymentController } from './controllers/payment.controller';
import { AuthController } from './controllers/auth.controller';
import { AdminController } from './controllers/admin.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminSettingsBankController } from './controllers/admin-settings-bank.controller';
import { AdminSettingsTaxController } from './controllers/admin-settings-tax.controller';
import { AdminSettingsShippingController } from './controllers/admin-settings-shipping.controller';
import { AdminAiController } from './controllers/admin-ai.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { SetupController } from './controllers/setup.controller';
import { HealthController } from './controllers/health.controller';
import { XenditWebhookController } from './controllers/xendit-webhook.controller';
import { AuthService } from './services/auth.service';
import { SetupService } from './services/setup.service';
import { SettingsService } from './services/settings.service';
import { ProductService } from './services/product.service';
import { OrderService } from './services/order.service';
import { RevenueService } from './services/revenue.service';
import { SessionService } from './services/session.service';
import { UploadService } from './services/upload.service';
import { AddressService } from './services/address.service';
import { EmailService } from './services/email.service';
import { AiService } from './services/ai.service';
import { ShippingService } from './services/shipping.service';
import { XenditService } from './services/xendit.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';

@Module({
  controllers: [
    HealthController,
    SetupController,
    StorefrontController,
    CartController,
    CheckoutController,
    PaymentController,
    AuthController,
    DashboardController,
    AdminController,
    AdminProductsController,
    AdminOrdersController,
    AdminSettingsController,
    AdminSettingsBankController,
    AdminSettingsTaxController,
    AdminSettingsShippingController,
    AdminAiController,
    XenditWebhookController,
  ],
  providers: [
    AuthService,
    SetupService,
    SettingsService,
    ProductService,
    OrderService,
    RevenueService,
    SessionService,
    UploadService,
    AddressService,
    EmailService,
    AiService,
    ShippingService,
    XenditService,
    PaymentConfirmationService,
  ],
})
export class AppModule {}
