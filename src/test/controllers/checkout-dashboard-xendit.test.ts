import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── CheckoutController ───────────────────────── */
describe('CheckoutController', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockSession: any, mockSettings: any, mockOrder: any, mockEmail: any, mockAddress: any, mockXendit: any;

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockProduct = { deductStock: vi.fn() };
    mockSession = { getCart: vi.fn(), clearCart: vi.fn(), getOrCreate: vi.fn() };
    mockSettings = { get: vi.fn(), getTaxRates: vi.fn(), getBankAccounts: vi.fn(), getActiveShippingMethods: vi.fn(), getCurrencies: vi.fn() };
    mockOrder = { create: vi.fn(), updatePaymentInfo: vi.fn(), getById: vi.fn() };
    mockEmail = { sendOrderCreatedXendit: vi.fn(), sendOrderCreatedManual: vi.fn() };
    mockAddress = { listByUser: vi.fn(), getById: vi.fn() };
    mockXendit = { createInvoice: vi.fn() };
    const { CheckoutController } = await import('../../controllers/checkout.controller');
    controller = new CheckoutController(mockAuth, mockProduct, mockSession, mockSettings, mockOrder, mockEmail, mockAddress, mockXendit);
  });

  it('checkoutPage redirects when cart empty', async () => {
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.checkoutPage(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });

  it('checkoutPage renders with tax and shipping', async () => {
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', name: 'P1', price: 1000, qty: 2, weight: 0, stock: 10 }] });
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'tax_enabled') return 'true';
      if (k === 'shipping_mode') return 'custom';
      return null;
    });
    mockSettings.getTaxRates.mockResolvedValue([{ id: '1', name: 'PPN', rate: '11', isActive: true }]);
    mockSettings.getBankAccounts.mockResolvedValue([{ id: 'b1', isActive: true }]);
    mockSettings.getActiveShippingMethods.mockResolvedValue([{ id: 's1', name: 'JNE', cost: 10000 }]);
    const r = res();
    await controller.checkoutPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('storefront/checkout.ejs', expect.objectContaining({ pageTitle: 'Checkout', tax: 220 }));
  });

  it('checkoutPage redirects when cart empty', async () => {
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.checkoutPage(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });

  it('checkoutSubmit redirects when cart empty', async () => {
    mockSession.getCart.mockResolvedValue({ sessionId: 'sid1', cart: [] });
    const r = res();
    await controller.checkoutSubmit(req({ body: {} }), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });

  it('checkoutSubmit redirects when no payment method', async () => {
    mockSession.getCart.mockResolvedValue({ sessionId: 'sid1', cart: [{ productId: 'p1', name: 'P1', price: 1000, qty: 1, weight: 0, stock: 10 }] });
    mockSettings.get.mockResolvedValue('24');
    mockSettings.getCurrencies.mockResolvedValue([]);
    mockSettings.getTaxRates.mockResolvedValue([]);
    const r = res();
    await controller.checkoutSubmit(req({ body: {} }), r);
    expect(r.redirect).toHaveBeenCalledWith('/checkout', 302);
  });

  it('checkoutSubmit with manual_transfer', async () => {
    const cart = [{ productId: 'p1', name: 'P1', price: 1000, qty: 1, weight: 0, stock: 10 }];
    mockSession.getCart.mockResolvedValue({ sessionId: 'sid1', cart });
    mockSettings.get.mockResolvedValue('24');
    mockSettings.getCurrencies.mockResolvedValue([{ code: 'IDR', isDefault: true }]);
    mockSettings.getTaxRates.mockResolvedValue([]);
    mockOrder.create.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, expiresAt: new Date() });
    mockSettings.getBankAccounts.mockResolvedValue([]);
    const r = res();
    await controller.checkoutSubmit(req({ body: { paymentMethod: 'manual_transfer', recipientName: 'A', phone: '081', addressLine: 'Jl. ABC', city: 'Jakarta', province: 'DKI', postalCode: '12345', email: 'a@b.com' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/checkout/success/o1', 302);
  });

  it('checkoutSubmit with xendit creates invoice', async () => {
    const cart = [{ productId: 'p1', name: 'P1', price: 1000, qty: 1, weight: 0, stock: 10, variantId: null }];
    mockSession.getCart.mockResolvedValue({ sessionId: 'sid1', cart });
    mockSettings.get.mockResolvedValue('24');
    mockSettings.getCurrencies.mockResolvedValue([{ code: 'IDR', isDefault: true }]);
    mockSettings.getTaxRates.mockResolvedValue([]);
    mockOrder.create.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, expiresAt: new Date() });
    mockXendit.createInvoice.mockResolvedValue({ id: 'inv1', invoice_url: 'https://pay.url' });
    mockSettings.getBankAccounts.mockResolvedValue([]);
    const r = res();
    const rq = req({ body: { paymentMethod: 'xendit', email: 'a@b.com', recipientName: 'A', phone: '081', addressLine: 'Jl. ABC', city: 'Jakarta', province: 'DKI', postalCode: '12345' }, protocol: 'https', host: 'example.com' });
    await controller.checkoutSubmit(rq, r);
    expect(r.redirect).toHaveBeenCalledWith('/checkout/success/o1', 302);
  });

  it('checkoutSuccessPage returns 404 when order not found', async () => {
    mockOrder.getById.mockResolvedValue(null);
    const r = res();
    await controller.checkoutSuccessPage('o1', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('checkoutSuccessPage renders', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, paymentMethod: 'manual_transfer', paymentUrl: null });
    mockSettings.getBankAccounts.mockResolvedValue([{ id: 'b1', isActive: true }]);
    const r = res();
    await controller.checkoutSuccessPage('o1', req(), r);
    expect(r.view).toHaveBeenCalledWith('storefront/checkout-success.ejs', expect.objectContaining({ pageTitle: 'Order Confirmed' }));
  });
});

/* ── DashboardController ──────────────────────── */
describe('DashboardController', () => {
  let controller: any;
  let mockAuth: any, mockOrder: any, mockAddress: any, mockSession: any;

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockOrder = { listByCustomer: vi.fn(), getById: vi.fn(), checkExpiry: vi.fn() };
    mockAddress = { listByUser: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    mockSession = { getCart: vi.fn() };
    const { DashboardController } = await import('../../controllers/dashboard.controller');
    controller = new DashboardController(mockAuth, mockOrder, mockAddress, mockSession);
  });

  function authed(overrides = {}) {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'customer' });
    return req({ cookies: { token: 'jwt' }, ...overrides });
  }

  it('dashboardPage redirects when not authenticated', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.dashboardPage(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('dashboardPage renders', async () => {
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockOrder.listByCustomer.mockResolvedValue({ orders: [{ id: 'o1', status: 'pending', total: 1000, items: [], createdAt: new Date() }], total: 1 });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.dashboardPage(authed(), r);
    expect(r.view).toHaveBeenCalledWith('dashboard/index.ejs', expect.objectContaining({ pageTitle: 'My Dashboard' }));
  });

  it('ordersPage renders', async () => {
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockOrder.listByCustomer.mockResolvedValue({ orders: [], page: 1, pages: 1 });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.ordersPage(authed(), r);
    expect(r.view).toHaveBeenCalledWith('dashboard/orders.ejs', expect.objectContaining({ pageTitle: 'My Orders' }));
  });

  it('orderDetailPage returns 404 when not found', async () => {
    mockOrder.getById.mockResolvedValue(null);
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.orderDetailPage('o1', authed(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('orderDetailPage returns 404 when wrong customer', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', customerId: 'other-user' });
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.orderDetailPage('o1', authed(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('orderDetailPage renders', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', customerId: 'u1', orderNumber: 'INV/001', status: 'pending', items: [], shippingAddress: { recipientName: 'John' } });
    mockOrder.checkExpiry.mockImplementation(async (o: any) => o);
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.orderDetailPage('o1', authed(), r);
    expect(r.view).toHaveBeenCalledWith('dashboard/order-detail.ejs', expect.objectContaining({ pageTitle: expect.stringContaining('INV/001') }));
  });

  it('addressesPage renders', async () => {
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    mockAddress.listByUser.mockResolvedValue([]);
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.addressesPage(authed(), r);
    expect(r.view).toHaveBeenCalledWith('dashboard/addresses.ejs', expect.objectContaining({ pageTitle: 'My Addresses' }));
  });

  it('addAddress creates address', async () => {
    mockAuth.getUserById.mockResolvedValue({ name: 'John' });
    const r = res();
    await controller.addAddress(authed({ body: { label: 'Home', recipientName: 'A', phone: '081', addressLine: 'Jl. ABC', city: 'Jakarta', province: 'DKI', postalCode: '12345', isDefault: '1' } }), r);
    expect(mockAddress.create).toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalledWith('/dashboard/addresses', 302);
  });

  it('addAddress does not create when fields missing', async () => {
    const r = res();
    await controller.addAddress(authed({ body: { label: 'Home' } }), r);
    expect(mockAddress.create).not.toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalledWith('/dashboard/addresses', 302);
  });

  it('editAddress updates', async () => {
    const r = res();
    await controller.editAddress('1', authed({ body: { label: 'New', recipientName: 'A', phone: '081', addressLine: 'Jl. ABC', city: 'Jakarta', province: 'DKI', postalCode: '12345' } }), r);
    expect(mockAddress.update).toHaveBeenCalled();
  });

  it('deleteAddress deletes', async () => {
    const r = res();
    await controller.deleteAddress('1', authed(), r);
    expect(mockAddress.delete).toHaveBeenCalled();
  });
});

/* ── XenditWebhookController ──────────────────── */
describe('XenditWebhookController', () => {
  let controller: any;
  let mockSettings: any, mockOrder: any, mockEmail: any;

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  beforeEach(async () => {
    mockSettings = { get: vi.fn() };
    mockOrder = { list: vi.fn(), updateStatus: vi.fn() };
    mockEmail = { sendPaymentConfirmed: vi.fn() };
    const { XenditWebhookController } = await import('../../controllers/xendit-webhook.controller');
    controller = new XenditWebhookController(mockSettings, mockOrder, mockEmail);
  });

  it('returns 503 when callback token not configured', async () => {
    mockSettings.get.mockResolvedValue(null);
    const r = res();
    await controller.handleWebhook(req({ headers: {} }), r);
    expect(r.status).toHaveBeenCalledWith(503);
  });

  it('returns 403 when callback token mismatches', async () => {
    mockSettings.get.mockResolvedValue('correct');
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'wrong' } }), r);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when body is invalid', async () => {
    mockSettings.get.mockResolvedValue('tok');
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'tok' }, body: {} }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when order not found', async () => {
    mockSettings.get.mockResolvedValue('tok');
    mockOrder.list.mockResolvedValue({ orders: [] });
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'tok' }, body: { external_id: 'INV/001', status: 'PAID' } }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('handles PAID status', async () => {
    mockSettings.get.mockResolvedValue('tok');
    mockOrder.list.mockResolvedValue({ orders: [{ id: 'o1', orderNumber: 'INV/001', status: 'pending', shippingAddress: { email: 'a@b.com' }, total: 1000, currency: 'IDR' }] });
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'tok' }, body: { external_id: 'INV/001', status: 'PAID' } }), r);
    expect(mockOrder.updateStatus).toHaveBeenCalledWith('o1', 'paid');
  });

  it('handles EXPIRED status', async () => {
    mockSettings.get.mockResolvedValue('tok');
    mockOrder.list.mockResolvedValue({ orders: [{ id: 'o1', orderNumber: 'INV/001', status: 'pending' }] });
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'tok' }, body: { external_id: 'INV/001', status: 'EXPIRED' } }), r);
    expect(mockOrder.updateStatus).toHaveBeenCalledWith('o1', 'expired');
  });

  it('ignores unknown status', async () => {
    mockSettings.get.mockResolvedValue('tok');
    mockOrder.list.mockResolvedValue({ orders: [{ id: 'o1', orderNumber: 'INV/001', status: 'pending' }] });
    const r = res();
    await controller.handleWebhook(req({ headers: { 'x-callback-token': 'tok' }, body: { external_id: 'INV/001', status: 'UNKNOWN' } }), r);
    expect(mockOrder.updateStatus).not.toHaveBeenCalled();
  });
});
