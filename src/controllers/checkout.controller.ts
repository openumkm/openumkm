import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { OrderService } from '../services/order.service';
import { EmailService } from '../services/email.service';
import { AddressService } from '../services/address.service';
import { XenditService } from '../services/xendit.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller()
export class CheckoutController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly sessionService: SessionService,
    private readonly settingsService: SettingsService,
    private readonly orderService: OrderService,
    private readonly emailService: EmailService,
    private readonly addressService: AddressService,
    private readonly xenditService: XenditService,
  ) {}

  private getAuth(req: FastifyRequest) {
    return getAuthFromRequest(req, this.authService);
  }

  @Get('/checkout')
  async checkoutPage(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = this.getAuth(req);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    if (cart.length === 0) return res.redirect('/cart', 302);

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    const taxRates = await this.settingsService.getTaxRates();
    const taxEnabled = (await this.settingsService.get('tax_enabled')) === 'true';
    const activeTaxes = taxEnabled ? taxRates.filter((t) => t.isActive) : [];

    let taxTotal = 0;
    for (const tax of activeTaxes) {
      taxTotal += Math.round(subtotal * (parseFloat(tax.rate) / 100));
    }

    const shippingMode = (await this.settingsService.get('shipping_mode')) || 'custom';
    const customMethods = (shippingMode === 'custom' || shippingMode === 'both')
      ? await this.settingsService.getActiveShippingMethods()
      : [];

    const rajaOngkirEnabled = (await this.settingsService.get('rajaongkir_enabled')) === 'true';
    const rajaOngkirApiKey = await this.settingsService.get('rajaongkir_api_key');
    const originCity = await this.settingsService.get('origin_city');
    const needsRajaOngkir = (shippingMode === 'rajaongkir' || shippingMode === 'both');
    const rajaOngkirReady = needsRajaOngkir ? !!(rajaOngkirApiKey && originCity) : true;

    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);

    const xenditEnabled = (await this.settingsService.get('xendit_enabled')) === 'true';
    const manualEnabled = (await this.settingsService.get('manual_transfer_enabled')) === 'true';

    let savedAddresses: any[] = [];
    if (auth) {
      savedAddresses = await this.addressService.listByUser(auth.sub);
    }

    return res.view('storefront/checkout.ejs', {
      pageTitle: 'Checkout',
      cartItems: cart,
      subtotal,
      shipping: 0,
      tax: taxTotal,
      total: subtotal + taxTotal,
      couriers: [],
      bankAccounts: activeBanks,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      xenditEnabled,
      manualEnabled,
      savedAddresses,
      customShippingMethods: customMethods,
      rajaOngkirReady,
      shippingMode,
      ...i18nContext(req),
    });
  }

  @Post('/checkout/submit')
  async checkoutSubmit(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId, cart } = await this.sessionService.getCart(req, res, auth?.sub);

    if (cart.length === 0) return res.redirect('/cart', 302);

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    const taxRates = await this.settingsService.getTaxRates();
    const taxEnabled = (await this.settingsService.get('tax_enabled')) === 'true';
    const activeTaxes = taxEnabled ? taxRates.filter((t) => t.isActive) : [];
    let taxTotal = 0;
    for (const tax of activeTaxes) {
      taxTotal += Math.round(subtotal * (parseFloat(tax.rate) / 100));
    }

    const shippingCost = parseInt(body.shippingCost || '0', 10);
    const total = subtotal + taxTotal + shippingCost;

    const paymentMethod = body.paymentMethod as 'xendit' | 'manual_transfer';
    if (!paymentMethod) return res.redirect('/checkout', 302);

    const expireHours = parseInt((await this.settingsService.get('auto_expire_hours')) || '24', 10);
    const currencies = await this.settingsService.getCurrencies();
    const defaultCurrency = currencies.find((c) => c.isDefault);
    const currency = defaultCurrency?.code || 'IDR';

    const shippingAddress = this.buildShippingAddress(body, auth, await this.resolveAddress(body, auth));

    const items = cart.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.name,
      variant: item.variant || null,
      price: item.price,
      qty: item.qty,
      image: item.image || null,
      weight: item.weight,
    }));

    for (const item of cart) {
      await this.productService.deductStock(item.productId, item.variantId, item.qty);
    }

    const order = await this.orderService.create({
      customerId: auth?.sub,
      paymentMethod,
      subtotal,
      taxTotal,
      shippingCost,
      total,
      currency,
      items,
      shippingAddress,
      courier: body.courier || undefined,
      courierService: body.courierService || undefined,
      expiresInHours: expireHours,
    });

    await this.sessionService.clearCart(sessionId);

    let paymentUrl: string | null = null;
    if (paymentMethod === 'xendit') {
      paymentUrl = await this.createXenditInvoice(req, order, total, shippingAddress, currency, items);
    }

    await this.sendOrderEmail(paymentMethod, order, currency, items, shippingAddress, paymentUrl);

    return res.redirect(`/checkout/success/${order.id}`, 302);
  }

  @Get('/checkout/success/:id')
  async checkoutSuccessPage(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);

    return res.view('storefront/checkout-success.ejs', {
      pageTitle: 'Order Confirmed',
      isLoggedIn: !!auth,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentUrl: order.paymentUrl,
      },
      bankAccounts: activeBanks,
      ...i18nContext(req),
    });
  }

  /* ── Private Helpers ─────────────────────────── */

  private async resolveAddress(body: Record<string, string>, auth: any) {
    if (body.savedAddressId && auth) {
      return this.addressService.getById(body.savedAddressId, auth.sub);
    }
    return null;
  }

  private buildShippingAddress(body: Record<string, string>, auth: any, savedAddr: any): Record<string, unknown> {
    if (savedAddr) {
      return {
        recipientName: savedAddr.recipientName,
        phone: savedAddr.phone,
        email: body.email || '',
        addressLine: savedAddr.addressLine,
        city: savedAddr.city,
        province: savedAddr.province,
        postalCode: savedAddr.postalCode,
      };
    }
    return {
      recipientName: body.recipientName || '',
      phone: body.phone || '',
      email: body.email || '',
      addressLine: body.addressLine || '',
      city: body.city || '',
      province: body.province || '',
      postalCode: body.postalCode || '',
    };
  }

  private async createXenditInvoice(req: FastifyRequest, order: any, total: number, shippingAddress: Record<string, unknown>, currency: string, items: any[]) {
    const proto = req.protocol || 'https';
    const host = req.host || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const invoice = await this.xenditService.createInvoice({
      externalId: order.orderNumber,
      amount: total,
      payerEmail: (shippingAddress.email as string) || '',
      description: `Order #${order.orderNumber}`,
      successRedirectUrl: `${baseUrl}/checkout/success/${order.id}`,
      failureRedirectUrl: `${baseUrl}/checkout`,
      currency,
      items: items.map((item) => ({ name: item.name, quantity: item.qty, price: item.price })),
    });

    if (invoice) {
      await this.orderService.updatePaymentInfo(order.id, invoice.id, invoice.invoice_url);
      return invoice.invoice_url;
    }
    return null;
  }

  private async sendOrderEmail(paymentMethod: string, order: any, currency: string, items: any[], shippingAddress: Record<string, unknown>, paymentUrl: string | null) {
    const customerEmail = (shippingAddress.email as string) || '';
    if (paymentMethod === 'xendit') {
      await this.emailService.sendOrderCreatedXendit({
        orderNumber: order.orderNumber, total: order.total, currency,
        paymentUrl: paymentUrl || order.paymentUrl, items, expiresAt: order.expiresAt,
      }, customerEmail);
    } else {
      const bankAccounts = await this.settingsService.getBankAccounts();
      const activeBanks = bankAccounts.filter((b) => b.isActive);
      await this.emailService.sendOrderCreatedManual({
        orderNumber: order.orderNumber, total: order.total, currency, items, expiresAt: order.expiresAt,
      }, customerEmail, activeBanks.map((b) => ({
        bankName: b.bankName, accountNumber: b.accountNumber, accountHolder: b.accountHolder,
      })));
    }
  }
}
