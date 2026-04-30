import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ProductService } from '../services/product.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { OrderService } from '../services/order.service';
import { EmailService } from '../services/email.service';
import { ShippingService } from '../services/shipping.service';
import { AddressService } from '../services/address.service';
import { XenditService } from '../services/xendit.service';
import { getAuthFromRequest } from '../common/auth.helper';
import { i18nContext } from '../common/view.helper';

@Controller()
export class StorefrontController {
  constructor(
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly sessionService: SessionService,
    private readonly settingsService: SettingsService,
    private readonly orderService: OrderService,
    private readonly emailService: EmailService,
    private readonly shippingService: ShippingService,
    private readonly addressService: AddressService,
    private readonly xenditService: XenditService,
  ) {}

  private getAuth(req: FastifyRequest) {
    return getAuthFromRequest(req, this.authService);
  }

  @Get('/')
  async homePage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const query = req.query as Record<string, string>;
    const search = query.q || '';
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '12', 10);
    const sort = query.sort || '';

    const result = await this.productService.list({
      search: search || undefined,
      page,
      limit,
      activeOnly: true,
      sort,
    });

    // Get primary image for each product
    const productsWithImages = await Promise.all(
      result.products.map(async (p) => {
        const images = await this.productService.getImages(p.id);
        const primary = images.find((i) => i.isPrimary) || images[0];
        return { ...p, image: primary?.url || null };
      }),
    );

    const { sessionId, cart } = await this.sessionService.getCart(req, res, auth?.sub);
    const seoTitle = await this.settingsService.get('seo_title');
    const seoDesc = await this.settingsService.get('seo_description');
    const storeName = await this.settingsService.get('store_name');

    return res.view('storefront/home.ejs', {
      pageTitle: seoTitle || storeName || 'Store',
      products: productsWithImages,
      search,
      page: result.page,
      pages: result.pages,
      sort,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      metaDescription: seoDesc || '',
      ...i18nContext(req),
    });
  }

  @Get('/product/:slug')
  async productDetailPage(@Param('slug') slug: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const product = await this.productService.getBySlug(slug);
    if (!product) return res.status(404).send('Product not found');

    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    // Get related products (same active, exclude current, limit 4)
    const related = await this.productService.list({ activeOnly: true, limit: 4 });
    const relatedWithImages = await Promise.all(
      related.products
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
        .map(async (p) => {
          const images = await this.productService.getImages(p.id);
          const primary = images.find((i) => i.isPrimary) || images[0];
          return { ...p, image: primary?.url || null };
        }),
    );

    return res.view('storefront/product-detail.ejs', {
      pageTitle: `${product.metaTitle || product.name} — Store`,
      product: {
        ...product,
        images: product.images.map((i) => i.url),
      },
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      relatedProducts: relatedWithImages,
      ...i18nContext(req),
    });
  }

  /* ── Cart Routes ─────────────────────────────── */

  @Post('/cart/add')
  async cartAdd(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const productId = body.productId;
    const variantId = body.variantId || undefined;
    const qty = Math.max(1, parseInt(body.qty || '1', 10));

    const product = await this.productService.getById(productId);
    if (!product) return res.redirect(302, '/');

    // Find variant if specified
    let price = product.price;
    let stock = product.stock;
    let weight = product.weight;
    let variantLabel = '';

    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        price = variant.price ?? product.price;
        stock = variant.stock;
        weight = variant.weight ?? product.weight;
        variantLabel = variant.name;
      }
    }

    // Stock check
    if (stock <= 0) return res.redirect(302, `/product/${product.slug}`);

    const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];

    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);
    await this.sessionService.addToCart(sessionId, {
      productId,
      variantId,
      name: product.name,
      variant: variantLabel || undefined,
      price,
      qty: Math.min(qty, stock),
      image: primaryImage?.url || undefined,
      weight,
      stock,
    });

    return res.redirect(302, '/cart');
  }

  @Get('/cart')
  async cartPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    // Refresh stock info for cart items
    const cartItems = await Promise.all(
      cart.map(async (item) => {
        const product = await this.productService.getById(item.productId);
        let currentStock = product?.stock || 0;
        if (item.variantId && product) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          currentStock = variant?.stock ?? currentStock;
        }
        const stockChanged = currentStock !== item.stock;
        return { ...item, stock: currentStock, stockChanged, outOfStock: currentStock <= 0 };
      }),
    );

    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    return res.view('storefront/cart.ejs', {
      pageTitle: 'Shopping Cart',
      cartItems,
      subtotal,
      cartCount: cartItems.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      ...i18nContext(req),
    });
  }

  @Post('/cart/update')
  async cartUpdate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);

    await this.sessionService.updateCartQty(
      sessionId,
      body.productId,
      body.variantId || undefined,
      Math.max(0, parseInt(body.qty || '1', 10)),
    );

    return res.redirect(302, '/cart');
  }

  @Post('/cart/remove')
  async cartRemove(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId } = await this.sessionService.getOrCreate(req, res, auth?.sub);

    await this.sessionService.removeFromCart(sessionId, body.productId, body.variantId || undefined);
    return res.redirect(302, '/cart');
  }

  /* ── Shipping AJAX ─────────────────────────────── */

  @Get('/api/shipping/search')
  async shippingSearch(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const query = (req.query as any).q || '';
    if (!query || query.length < 2) return res.send({ results: [] });

    const results = await this.shippingService.searchDestination(query, 10);
    return res.send({ results });
  }

  @Post('/api/shipping/calculate')
  async shippingCalculate(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const body = req.body as Record<string, string>;
    const { destination } = body;

    if (!destination) return res.send({ services: [] });

    const shippingMode = (await this.settingsService.get('shipping_mode')) || 'custom';
    const rajaOngkirEnabled = (await this.settingsService.get('rajaongkir_enabled')) === 'true';

    // Get custom shipping methods if mode supports it
    let customServices: any[] = [];
    if (shippingMode === 'custom' || shippingMode === 'both') {
      const methods = await this.settingsService.getActiveShippingMethods();
      customServices = methods.map((m) => ({
        courier: m.name,
        service: m.description || m.name,
        cost: m.cost,
        description: m.description || null,
        etd: '—',
      }));
    }

    // If rajaongkir disabled or mode is custom-only, return just custom
    if (shippingMode === 'custom' || !rajaOngkirEnabled) {
      return res.send({ services: customServices });
    }

    // Get RajaOngkir services
    const rajaOngkirServices: any[] = [];
    if (shippingMode === 'rajaongkir' || shippingMode === 'both') {
      const origin = await this.settingsService.get('origin_city');
      if (!origin) {
        // Fallback to custom
        return res.send({ services: customServices, error: !customServices.length ? 'Origin city not configured.' : undefined });
      }

      const auth = this.getAuth(req);
      const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
      const totalWeight = cart.reduce((sum, item) => sum + (item.weight * item.qty), 0);

      if (totalWeight > 0) {
        const services = await this.shippingService.calculateCost(origin, destination, totalWeight);
        rajaOngkirServices.push(...services);
      }
    }

    // Combine both in 'both' mode
    const allServices = [...customServices, ...rajaOngkirServices];
    return res.send({ services: allServices });
  }

  /* ── Checkout ────────────────────────────────── */

  @Get('/checkout')
  async checkoutPage(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    if (cart.length === 0) return res.redirect(302, '/cart');

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    // Get active tax rates
    const taxRates = await this.settingsService.getTaxRates();
    const taxEnabled = (await this.settingsService.get('tax_enabled')) === 'true';
    const activeTaxes = taxEnabled ? taxRates.filter((t) => t.isActive) : [];

    let taxTotal = 0;
    for (const tax of activeTaxes) {
      taxTotal += Math.round(subtotal * (parseFloat(tax.rate) / 100));
    }

    // Get enabled couriers
    const enabledCouriersStr = await this.settingsService.get('enabled_couriers');
    const enabledCodes = (enabledCouriersStr || '').split(',').filter(Boolean);

    // RajaOngkir settings
    const rajaOngkirEnabled = (await this.settingsService.get('rajaongkir_enabled')) === 'true';
    const shippingMode = (await this.settingsService.get('shipping_mode')) || 'custom';

    // Get custom shipping methods
    const customMethods = (shippingMode === 'custom' || shippingMode === 'both')
      ? await this.settingsService.getActiveShippingMethods()
      : [];

    // Get bank accounts for manual transfer
    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);

    // Payment method availability
    const xenditEnabled = (await this.settingsService.get('xendit_enabled')) === 'true';
    const manualEnabled = (await this.settingsService.get('manual_transfer_enabled')) === 'true';

    // Get saved addresses if logged in
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
      ...i18nContext(req),
    });
  }

  @Post('/checkout/submit')
  async checkoutSubmit(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const body = req.body as Record<string, string>;
    const { sessionId, cart } = await this.sessionService.getCart(req, res, auth?.sub);

    if (cart.length === 0) return res.redirect(302, '/cart');

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    // Calculate tax
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
    if (!paymentMethod) return res.redirect(302, '/checkout');

    // Get auto-expire hours
    const expireHours = parseInt((await this.settingsService.get('auto_expire_hours')) || '24', 10);

    // Get default currency
    const currencies = await this.settingsService.getCurrencies();
    const defaultCurrency = currencies.find((c) => c.isDefault);
    const currency = defaultCurrency?.code || 'IDR';

    // Build shipping address
    let shippingAddress: Record<string, unknown>;

    const savedAddressId = body.savedAddressId;
    if (savedAddressId && auth) {
      const savedAddr = await this.addressService.getById(savedAddressId, auth.sub);
      if (savedAddr) {
        shippingAddress = {
          recipientName: savedAddr.recipientName,
          phone: savedAddr.phone,
          email: body.email || '',
          addressLine: savedAddr.addressLine,
          city: savedAddr.city,
          province: savedAddr.province,
          postalCode: savedAddr.postalCode,
        };
      } else {
        shippingAddress = {
          recipientName: body.recipientName || '',
          phone: body.phone || '',
          email: body.email || '',
          addressLine: body.addressLine || '',
          city: body.city || '',
          province: body.province || '',
          postalCode: body.postalCode || '',
        };
      }
    } else {
      shippingAddress = {
        recipientName: body.recipientName || '',
        phone: body.phone || '',
        email: body.email || '',
        addressLine: body.addressLine || '',
        city: body.city || '',
        province: body.province || '',
        postalCode: body.postalCode || '',
      };
    }

    // Build items snapshot
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

    // Deduct stock
    for (const item of cart) {
      await this.productService.deductStock(item.productId, item.variantId, item.qty);
    }

    // Create order
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

    // Clear cart
    await this.sessionService.clearCart(sessionId);

    // Create Xendit invoice if applicable
    let paymentUrl: string | null = null;
    if (paymentMethod === 'xendit') {
      const proto = (req as any).protocol || 'https';
      const host = (req as any).hostname || 'localhost:3000';
      const baseUrl = `${proto}://${host}`;

      const invoice = await this.xenditService.createInvoice({
        externalId: order.orderNumber,
        amount: total,
        payerEmail: (shippingAddress.email as string) || '',
        description: `Order #${order.orderNumber}`,
        successRedirectUrl: `${baseUrl}/checkout/success/${order.id}`,
        failureRedirectUrl: `${baseUrl}/checkout`,
        currency,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          price: item.price,
        })),
      });

      if (invoice) {
        paymentUrl = invoice.invoice_url;
        await this.orderService.updatePaymentInfo(order.id, invoice.id, invoice.invoice_url);
      }
    }

    // Send order confirmation email
    const customerEmail = (shippingAddress.email as string) || '';
    if (paymentMethod === 'xendit') {
      await this.emailService.sendOrderCreatedXendit({
        orderNumber: order.orderNumber,
        total: order.total,
        currency,
        paymentUrl: paymentUrl || order.paymentUrl,
        items,
        expiresAt: order.expiresAt,
      }, customerEmail);
    } else {
      const bankAccounts = await this.settingsService.getBankAccounts();
      const activeBanks = bankAccounts.filter((b) => b.isActive);
      await this.emailService.sendOrderCreatedManual({
        orderNumber: order.orderNumber,
        total: order.total,
        currency,
        items,
        expiresAt: order.expiresAt,
      }, customerEmail, activeBanks.map((b) => ({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountHolder: b.accountHolder,
      })));
    }

    return res.redirect(302, `/checkout/success/${order.id}`);
  }

  @Get('/checkout/success/:id')
  async checkoutSuccessPage(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);

    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

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

  /* ── Payment Confirmation ────────────────────── */

  @Get('/payment/confirm/:id')
  async paymentConfirmPage(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    const bankAccounts = await this.settingsService.getBankAccounts();
    const activeBanks = bankAccounts.filter((b) => b.isActive);
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);

    return res.view('storefront/payment-confirmation.ejs', {
      pageTitle: 'Payment Confirmation',
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: order.total,
      bankAccounts: activeBanks,
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      error: null,
      success: false,
      ...i18nContext(req),
    });
  }

  @Post('/payment/confirm/:id')
  async paymentConfirmSubmit(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const auth = this.getAuth(req);
    const order = await this.orderService.getById(id);
    if (!order) return res.status(404).send('Order not found');

    // Parse multipart form data
    const parts = (req as any).parts();
    const fields: Record<string, string> = {};
    let receiptImageUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'receiptImage') {
        const buffer = await part.toBuffer();
        if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
          const { v4: uuidv4 } = await import('uuid');
          const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const { join } = await import('path');
          const { existsSync, mkdirSync, writeFileSync } = await import('fs');
          const dir = join(process.cwd(), 'uploads', 'receipts');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, filename), buffer);
          receiptImageUrl = `/uploads/receipts/${filename}`;
        }
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value;
      }
    }

    if (!receiptImageUrl || !fields.senderBank || !fields.senderName || !fields.amount || !fields.transferDate) {
      const bankAccounts = await this.settingsService.getBankAccounts();
      const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
      return res.view('storefront/payment-confirmation.ejs', {
        pageTitle: 'Payment Confirmation',
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: order.total,
        bankAccounts: bankAccounts.filter((b) => b.isActive),
        cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
        isLoggedIn: !!auth,
        error: 'Please fill all required fields and upload receipt image.',
        success: false,
        ...i18nContext(req),
      });
    }

    // Create payment confirmation
    await this.orderService.createPaymentConfirmation({
      orderId: order.id,
      senderBank: fields.senderBank,
      senderName: fields.senderName,
      amount: parseInt(fields.amount, 10),
      transferDate: fields.transferDate,
      receiptImage: receiptImageUrl,
      notes: fields.notes || null,
    });

    // Update order status to waiting_confirmation
    await this.orderService.updateStatus(order.id, 'waiting_confirmation');

    // Notify seller via email
    await this.emailService.sendPaymentProofUploaded(
      { orderNumber: order.orderNumber, total: order.total, id: order.id },
      { senderBank: fields.senderBank, senderName: fields.senderName, amount: parseInt(fields.amount, 10) },
    );

    const bankAccounts = await this.settingsService.getBankAccounts();
    const { cart } = await this.sessionService.getCart(req, res, auth?.sub);
    return res.view('storefront/payment-confirmation.ejs', {
      pageTitle: 'Payment Confirmation',
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: order.total,
      bankAccounts: bankAccounts.filter((b) => b.isActive),
      cartCount: cart.reduce((sum, i) => sum + i.qty, 0),
      isLoggedIn: !!auth,
      error: null,
      success: true,
      ...i18nContext(req),
    });
  }
}
