import { describe, it, expect, vi, beforeEach } from 'vitest';

function req(overrides = {}) {
  return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: { token: 'jwt' }, query: {}, body: {}, ...overrides };
}
function res() {
  return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
}

/* ── AdminController ──────────────────────────── */
describe('AdminController', () => {
  let controller: any;
  let mockAuth: any, mockOrder: any, mockRevenue: any;

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockOrder = { list: vi.fn() };
    mockRevenue = { getRevenueStats: vi.fn(), getRevenueBreakdown: vi.fn() };
    const { AdminController } = await import('../../controllers/admin.controller');
    controller = new AdminController(mockAuth, mockOrder, mockRevenue);
  });

  it('adminDashboard redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.adminDashboard(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('adminDashboard renders', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
    mockRevenue.getRevenueStats.mockResolvedValue({ totalRevenue: 100000, totalOrders: 5 });
    mockOrder.list.mockResolvedValue({ orders: [] });
    mockRevenue.getRevenueBreakdown.mockResolvedValue({});
    const r = res();
    await controller.adminDashboard(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/dashboard.ejs', expect.objectContaining({ pageTitle: 'Admin Dashboard' }));
  });

  it('revenueEndpoint returns 401 when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.revenueEndpoint(req(), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('revenueEndpoint returns stats', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockRevenue.getRevenueStats.mockResolvedValue({ totalRevenue: 100000, totalOrders: 5 });
    mockRevenue.getRevenueBreakdown.mockResolvedValue({});
    const r = res();
    await controller.revenueEndpoint(req({ query: { period: 'daily' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ totalRevenue: 100000 }));
  });
});

/* ── AdminOrdersController ────────────────────── */
describe('AdminOrdersController', () => {
  let controller: any;
  let mockAuth: any, mockOrder: any, mockPaymentConfirm: any, mockEmail: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockOrder = { list: vi.fn(), getById: vi.fn(), checkExpiry: vi.fn(), updateStatus: vi.fn(), setTracking: vi.fn() };
    mockPaymentConfirm = { list: vi.fn(), approve: vi.fn(), reject: vi.fn(), getOrderByConfirmationId: vi.fn() };
    mockEmail = { sendOrderCancelled: vi.fn(), sendOrderShipped: vi.fn(), sendPaymentConfirmed: vi.fn(), sendPaymentRejected: vi.fn() };
    const { AdminOrdersController } = await import('../../controllers/admin-orders.controller');
    controller = new AdminOrdersController(mockAuth, mockOrder, mockPaymentConfirm, mockEmail);
  });

  it('orderList redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.orderList(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('orderList renders', async () => {
    sellerGuard();
    mockOrder.list.mockResolvedValue({ orders: [{ id: 'o1', orderNumber: 'INV/001', total: 1000, status: 'pending', paymentMethod: 'manual', createdAt: new Date(), shippingAddress: { recipientName: 'A' } }], page: 1, pages: 1 });
    const r = res();
    await controller.orderList(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/orders.ejs', expect.objectContaining({ pageTitle: 'Orders — Admin' }));
  });

  it('orderDetail returns 404 when not found', async () => {
    sellerGuard();
    mockOrder.getById.mockResolvedValue(null);
    const r = res();
    await controller.orderDetail('o1', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('orderDetail renders', async () => {
    sellerGuard();
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', status: 'pending', items: [], shippingAddress: { recipientName: 'A', email: 'a@b.com' } });
    mockOrder.checkExpiry.mockImplementation(async (o: any) => o);
    const r = res();
    await controller.orderDetail('o1', req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/order-detail.ejs', expect.objectContaining({ pageTitle: expect.stringContaining('INV/001') }));
  });

  it('updateStatus sends cancelled email', async () => {
    sellerGuard();
    mockOrder.updateStatus.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, shippingAddress: { email: 'a@b.com' } });
    const r = res();
    await controller.updateStatus('o1', req({ body: { status: 'cancelled' } }), r);
    expect(mockEmail.sendOrderCancelled).toHaveBeenCalled();
  });

  it('updateStatus sends shipped email', async () => {
    sellerGuard();
    mockOrder.updateStatus.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, shippingAddress: { email: 'a@b.com' } });
    const r = res();
    await controller.updateStatus('o1', req({ body: { status: 'shipped' } }), r);
    expect(mockEmail.sendOrderShipped).toHaveBeenCalled();
  });

  it('updateStatus handles missing order', async () => {
    sellerGuard();
    mockOrder.updateStatus.mockResolvedValue(null);
    const r = res();
    await controller.updateStatus('o1', req({ body: { status: 'completed' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/admin/orders/o1', 302);
  });

  it('setTracking sets tracking info', async () => {
    sellerGuard();
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', courier: 'JNE', courierService: 'REG', trackingNumber: '123', shippingAddress: { email: 'a@b.com' } });
    const r = res();
    await controller.setTracking('o1', req({ body: { trackingNumber: 'TRACK123' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/admin/orders/o1', 302);
  });

  it('paymentConfirmations renders', async () => {
    sellerGuard();
    mockPaymentConfirm.list.mockResolvedValue([]);
    const r = res();
    await controller.paymentConfirmations(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/payment-confirmations.ejs', expect.objectContaining({ pageTitle: 'Payment Confirmations — Admin' }));
  });

  it('approvePayment approves', async () => {
    sellerGuard();
    mockPaymentConfirm.approve.mockResolvedValue({ id: 'pc1', orderId: 'o1' });
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000, currency: 'IDR', shippingAddress: { email: 'a@b.com' } });
    const r = res();
    await controller.approvePayment('pc1', req(), r);
    expect(mockEmail.sendPaymentConfirmed).toHaveBeenCalled();
  });

  it('approvePayment handles missing payment confirmation', async () => {
    sellerGuard();
    mockPaymentConfirm.approve.mockResolvedValue(null);
    const r = res();
    await controller.approvePayment('pc1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/admin/payments/confirmations', 302);
  });

  it('rejectPayment rejects', async () => {
    sellerGuard();
    mockPaymentConfirm.getOrderByConfirmationId.mockResolvedValue({ orderNumber: 'INV/001', total: 1000, shippingAddress: { email: 'a@b.com' } });
    const r = res();
    await controller.rejectPayment('pc1', req({ body: { reason: 'Invalid' } }), r);
    expect(mockEmail.sendPaymentRejected).toHaveBeenCalled();
  });
});

/* ── AdminProductsController ──────────────────── */
describe('AdminProductsController', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockUpload: any, mockSettings: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockProduct = { list: vi.fn(), getImages: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), addImage: vi.fn(), deleteImage: vi.fn(), setPrimaryImage: vi.fn(), addVariant: vi.fn(), deleteVariant: vi.fn(), generateSlug: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn() };
    mockSettings = { getMany: vi.fn(), get: vi.fn() };
    const { AdminProductsController } = await import('../../controllers/admin-products.controller');
    controller = new AdminProductsController(mockAuth, mockProduct, mockUpload, mockSettings);
  });

  it('productList renders', async () => {
    sellerGuard();
    mockProduct.list.mockResolvedValue({ products: [{ id: 'p1', name: 'Test' }], page: 1, pages: 1 });
    mockProduct.getImages.mockResolvedValue([]);
    const r = res();
    await controller.productList(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/products.ejs', expect.objectContaining({ pageTitle: 'Products — Admin' }));
  });

  it('newProductForm renders', async () => {
    sellerGuard();
    mockSettings.getMany.mockResolvedValue({ ai_enabled: 'false', ai_base_url: '', ai_api_key: '', ai_model: '', default_language: 'en' });
    const r = res();
    await controller.newProductForm(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/product-form.ejs', expect.objectContaining({ pageTitle: 'New Product — Admin' }));
  });

  it('newProductForm with AI enabled', async () => {
    sellerGuard();
    mockSettings.getMany.mockResolvedValue({ ai_enabled: 'true', ai_base_url: 'https://ai.example.com/', ai_api_key: 'sk-123', ai_model: 'gpt-4', default_language: 'id' });
    const r = res();
    await controller.newProductForm(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/product-form.ejs', expect.objectContaining({ aiConfig: expect.objectContaining({ enabled: true }) }));
  });

  it('createProduct creates product', async () => {
    sellerGuard();
    mockProduct.create.mockResolvedValue({ id: 'p1', slug: 'test' });
    mockProduct.generateSlug.mockImplementation((n: string) => n.toLowerCase().replace(/\s+/g, '-'));
    mockUpload.uploadBuffer.mockResolvedValue('/uploads/products/img.jpg');

    const parts = [
      { type: 'field', fieldname: 'name', value: 'New Product' },
      { type: 'field', fieldname: 'price', value: '10000' },
      { type: 'field', fieldname: 'stock', value: '10' },
      { type: 'field', fieldname: 'weight', value: '500' },
      { type: 'field', fieldname: 'description', value: 'Nice' },
      { type: 'field', fieldname: 'metaTitle', value: 'Title' },
      { type: 'file', fieldname: 'images', toBuffer: () => Buffer.from('data'), mimetype: 'image/jpeg' },
    ];
    let i = 0;
    const asyncParts = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) }) };

    const r = res();
    const rq = { ...req({}), parts: () => asyncParts };
    await controller.createProduct(rq, r);
    expect(mockProduct.create).toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalled();
  });
});

/* ── AdminSettingsController ──────────────────── */
describe('AdminSettingsController', () => {
  let controller: any;
  let mockAuth: any, mockSettings: any, mockUpload: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockSettings = { getMany: vi.fn(), setMany: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn() };
    const { AdminSettingsController } = await import('../../controllers/admin-settings.controller');
    controller = new AdminSettingsController(mockAuth, mockSettings, mockUpload);
  });

  it('settingsPage renders', async () => {
    sellerGuard();
    mockSettings.getMany.mockResolvedValue({});
    const r = res();
    await controller.settingsPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings.ejs', expect.objectContaining({ pageTitle: 'Settings — Admin' }));
  });

  it('saveSettings saves', async () => {
    sellerGuard();
    const parts = [
      { type: 'field', fieldname: 'storeName', value: 'My Store' },
      { type: 'field', fieldname: 'storeEmail', value: 'a@b.com' },
      { type: 'field', fieldname: 'couriers[]', value: 'jne' },
      { type: 'file', fieldname: 'logo', toBuffer: () => Buffer.from('data'), mimetype: 'image/png' },
    ];
    let i = 0;
    const asyncParts = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) }) };
    mockUpload.uploadBuffer.mockResolvedValue('/uploads/logos/logo.png');
    const r = res();
    await controller.saveSettings({ ...req({}), parts: () => asyncParts }, r);
    expect(mockSettings.setMany).toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalledWith('/admin/settings', 302);
  });
});

/* ── AdminSettingsBankController ──────────────── */
describe('AdminSettingsBankController', () => {
  let controller: any;
  let mockAuth: any, mockSettings: any, mockUpload: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockSettings = { getBankAccounts: vi.fn(), addBankAccount: vi.fn(), editBankAccount: vi.fn(), toggleBankAccount: vi.fn(), deleteBankAccount: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn() };
    const { AdminSettingsBankController } = await import('../../controllers/admin-settings-bank.controller');
    controller = new AdminSettingsBankController(mockAuth, mockSettings, mockUpload);
  });

  it('bankAccountsPage renders', async () => {
    sellerGuard();
    mockSettings.getBankAccounts.mockResolvedValue([]);
    const r = res();
    await controller.bankAccountsPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings-bank-accounts.ejs', expect.objectContaining({ pageTitle: 'Bank Accounts — Admin' }));
  });

  it('addBankAccount adds', async () => {
    sellerGuard();
    const parts = [
      { type: 'field', fieldname: 'bankName', value: 'BCA' },
      { type: 'field', fieldname: 'accountNumber', value: '123' },
      { type: 'field', fieldname: 'accountHolder', value: 'Owner' },
    ];
    let i = 0;
    const asyncParts = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) }) };
    const r = res();
    await controller.addBankAccount({ ...req({}), parts: () => asyncParts }, r);
    expect(mockSettings.addBankAccount).toHaveBeenCalled();
  });

  it('editBankAccount edits', async () => {
    sellerGuard();
    const parts = [
      { type: 'field', fieldname: 'bankName', value: 'BNI' },
      { type: 'field', fieldname: 'accountNumber', value: '456' },
      { type: 'field', fieldname: 'accountHolder', value: 'Owner' },
    ];
    let i = 0;
    const asyncParts = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) }) };
    const r = res();
    await controller.editBankAccount('1', { ...req({}), parts: () => asyncParts }, r);
    expect(mockSettings.editBankAccount).toHaveBeenCalled();
  });

  it('toggleBankAccount toggles', async () => {
    sellerGuard();
    const r = res();
    await controller.toggleBankAccount('1', req(), r);
    expect(mockSettings.toggleBankAccount).toHaveBeenCalledWith('1');
  });

  it('deleteBankAccount deletes', async () => {
    sellerGuard();
    const r = res();
    await controller.deleteBankAccount('1', req(), r);
    expect(mockSettings.deleteBankAccount).toHaveBeenCalledWith('1');
  });
});

/* ── AdminSettingsTaxController ───────────────── */
describe('AdminSettingsTaxController', () => {
  let controller: any;
  let mockAuth: any, mockSettings: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockSettings = { getTaxRates: vi.fn(), get: vi.fn(), addTaxRate: vi.fn(), editTaxRate: vi.fn(), toggleTaxRate: vi.fn(), deleteTaxRate: vi.fn() };
    const { AdminSettingsTaxController } = await import('../../controllers/admin-settings-tax.controller');
    controller = new AdminSettingsTaxController(mockAuth, mockSettings);
  });

  it('taxRatesPage renders', async () => {
    sellerGuard();
    mockSettings.getTaxRates.mockResolvedValue([]);
    mockSettings.get.mockResolvedValue('true');
    const r = res();
    await controller.taxRatesPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings-taxes.ejs', expect.objectContaining({ taxEnabled: true }));
  });

  it('addTaxRate adds', async () => {
    sellerGuard();
    const r = res();
    await controller.addTaxRate(req({ body: { name: 'PPN', rate: '11' } }), r);
    expect(mockSettings.addTaxRate).toHaveBeenCalled();
  });

  it('editTaxRate edits', async () => {
    sellerGuard();
    const r = res();
    await controller.editTaxRate('1', req({ body: { name: 'PPN', rate: '12' } }), r);
    expect(mockSettings.editTaxRate).toHaveBeenCalled();
  });

  it('toggleTaxRate toggles', async () => {
    sellerGuard();
    const r = res();
    await controller.toggleTaxRate('1', req(), r);
    expect(mockSettings.toggleTaxRate).toHaveBeenCalledWith('1');
  });

  it('deleteTaxRate deletes', async () => {
    sellerGuard();
    const r = res();
    await controller.deleteTaxRate('1', req(), r);
    expect(mockSettings.deleteTaxRate).toHaveBeenCalledWith('1');
  });
});

/* ── AdminSettingsShippingController ──────────── */
describe('AdminSettingsShippingController', () => {
  let controller: any;
  let mockAuth: any, mockSettings: any;

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockSettings = { getCurrencies: vi.fn(), toggleCurrency: vi.fn(), updateExchangeRate: vi.fn(), getShippingMethods: vi.fn(), addShippingMethod: vi.fn(), editShippingMethod: vi.fn(), toggleShippingMethod: vi.fn(), deleteShippingMethod: vi.fn() };
    const { AdminSettingsShippingController } = await import('../../controllers/admin-settings-shipping.controller');
    controller = new AdminSettingsShippingController(mockAuth, mockSettings);
  });

  it('currenciesPage renders', async () => {
    sellerGuard();
    mockSettings.getCurrencies.mockResolvedValue([]);
    const r = res();
    await controller.currenciesPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings-currencies.ejs', expect.objectContaining({ pageTitle: 'Currencies — Admin' }));
  });

  it('toggleCurrency toggles', async () => {
    sellerGuard();
    const r = res();
    await controller.toggleCurrency(req({ body: { code: 'USD' } }), r);
    expect(mockSettings.toggleCurrency).toHaveBeenCalledWith('USD');
  });

  it('updateExchangeRate updates', async () => {
    sellerGuard();
    const r = res();
    await controller.updateExchangeRate('USD', req({ body: { exchangeRate: '0.000064' } }), r);
    expect(mockSettings.updateExchangeRate).toHaveBeenCalledWith('USD', '0.000064');
  });

  it('shippingMethodsPage renders', async () => {
    sellerGuard();
    mockSettings.getShippingMethods.mockResolvedValue([]);
    const r = res();
    await controller.shippingMethodsPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings-shipping-methods.ejs', expect.objectContaining({ pageTitle: 'Shipping Methods — Admin' }));
  });

  it('addShippingMethod adds', async () => {
    sellerGuard();
    const r = res();
    await controller.addShippingMethod(req({ body: { name: 'JNE', cost: '10000', description: 'Reg' } }), r);
    expect(mockSettings.addShippingMethod).toHaveBeenCalled();
  });

  it('editShippingMethod edits', async () => {
    sellerGuard();
    const r = res();
    await controller.editShippingMethod('1', req({ body: { name: 'JNE', cost: '15000' } }), r);
    expect(mockSettings.editShippingMethod).toHaveBeenCalled();
  });

  it('toggleShippingMethod toggles', async () => {
    sellerGuard();
    const r = res();
    await controller.toggleShippingMethod('1', req(), r);
    expect(mockSettings.toggleShippingMethod).toHaveBeenCalledWith('1');
  });

  it('deleteShippingMethod deletes', async () => {
    sellerGuard();
    const r = res();
    await controller.deleteShippingMethod('1', req(), r);
    expect(mockSettings.deleteShippingMethod).toHaveBeenCalledWith('1');
  });
});

/* ── AdminSettingsController ──────────────────── */
describe('AdminSettingsController', () => {
  let controller: any;
  let mockAuth: any, mockSettings: any, mockUpload: any;

  function mockParts(items: any[]) {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const item of items) yield item;
      },
    };
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockSettings = { getMany: vi.fn(), setMany: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn() };
    const { AdminSettingsController } = await import('../../controllers/admin-settings.controller');
    controller = new AdminSettingsController(mockAuth, mockSettings, mockUpload);
  });

  it('settingsPage redirects when not authenticated', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.settingsPage(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('settingsPage renders settings page with data', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
    mockSettings.getMany.mockResolvedValue({
      store_name: 'My Store', store_email: '', store_phone: '',
      invoice_prefix: 'INV', default_language: 'id',
      xendit_secret_key: '', rajaongkir_api_key: '', origin_city: '', origin_city_label: '',
      smtp_host: '', smtp_port: '587', smtp_username: '', smtp_password: '',
      smtp_from_address: '', smtp_enabled: 'false', xendit_enabled: 'false',
      manual_transfer_enabled: 'false', auto_expire_hours: '24', tax_enabled: 'false',
      seo_title: '', seo_description: '',
      ai_base_url: '', ai_api_key: '', ai_model: '', ai_enabled: 'false',
      rajaongkir_enabled: 'false', shipping_mode: 'custom',
      s3_endpoint: '', s3_region: 'us-east-1', s3_bucket: '',
      s3_access_key: '', s3_secret_key: '', s3_enabled: 'false',
      enabled_couriers: '', store_logo: null,
    });
    const r = res();
    await controller.settingsPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/settings.ejs', expect.objectContaining({
      pageTitle: 'Settings — Admin',
      userName: 'Admin',
    }));
  });

  it('saveSettings redirects when not authenticated', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    const mockReq = { ...req(), parts: () => mockParts([]) };
    await controller.saveSettings(mockReq, r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('saveSettings processes field parts and saves', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'storeName', value: 'My Store' },
        { type: 'field', fieldname: 'storeEmail', value: 'store@test.com' },
      ]),
    };
    await controller.saveSettings(mockReq, r);
    expect(mockSettings.setMany).toHaveBeenCalledWith(
      expect.objectContaining({ store_name: 'My Store', store_email: 'store@test.com' }),
    );
    expect(r.redirect).toHaveBeenCalledWith('/admin/settings', 302);
  });

  it('saveSettings with logo file upload', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockUpload.uploadBuffer.mockResolvedValue('https://cdn.example.com/logo.png');
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'file', fieldname: 'logo', toBuffer: async () => Buffer.from('data'), mimetype: 'image/png' },
        { type: 'field', fieldname: 'storeName', value: 'My Store' },
      ]),
    };
    await controller.saveSettings(mockReq, r);
    expect(mockUpload.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'logos', 'image/png');
    expect(mockSettings.setMany).toHaveBeenCalledWith(
      expect.objectContaining({ store_logo: 'https://cdn.example.com/logo.png', store_name: 'My Store' }),
    );
    expect(r.redirect).toHaveBeenCalledWith('/admin/settings', 302);
  });

  it('saveSettings with couriers[] array field', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'couriers[]', value: 'jne' },
        { type: 'field', fieldname: 'couriers[]', value: 'tiki' },
        { type: 'field', fieldname: 'storeName', value: 'My Store' },
      ]),
    };
    await controller.saveSettings(mockReq, r);
    expect(mockSettings.setMany).toHaveBeenCalledWith(
      expect.objectContaining({ enabled_couriers: 'jne,tiki', store_name: 'My Store' }),
    );
    expect(r.redirect).toHaveBeenCalledWith('/admin/settings', 302);
  });

  it('saveSettings with logo AND couriers', async () => {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockUpload.uploadBuffer.mockResolvedValue('https://cdn.example.com/logo.png');
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'file', fieldname: 'logo', toBuffer: async () => Buffer.from('data'), mimetype: 'image/png' },
        { type: 'field', fieldname: 'couriers[]', value: 'jne' },
        { type: 'field', fieldname: 'couriers[]', value: 'jnt' },
        { type: 'field', fieldname: 'storeName', value: 'My Store' },
      ]),
    };
    await controller.saveSettings(mockReq, r);
    expect(mockUpload.uploadBuffer).toHaveBeenCalled();
    expect(mockSettings.setMany).toHaveBeenCalledWith(
      expect.objectContaining({
        store_logo: 'https://cdn.example.com/logo.png',
        enabled_couriers: 'jne,jnt',
        store_name: 'My Store',
      }),
    );
    expect(r.redirect).toHaveBeenCalledWith('/admin/settings', 302);
  });
});

/* ── AdminProductsController ──────────────────── */
describe('AdminProductsController', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockUpload: any, mockSettings: any;

  function mockParts(items: any[]) {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const item of items) yield item;
      },
    };
  }

  function sellerGuard() {
    mockAuth.verifyToken.mockReturnValue({ sub: 'u1', role: 'seller' });
    mockAuth.getUserById.mockResolvedValue({ name: 'Admin' });
  }

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn(), getUserById: vi.fn() };
    mockProduct = { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), getImages: vi.fn(), addImage: vi.fn(), deleteImage: vi.fn(), setPrimaryImage: vi.fn(), addVariant: vi.fn(), deleteVariant: vi.fn(), generateSlug: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn(), deleteFile: vi.fn() };
    mockSettings = { getMany: vi.fn() };
    const { AdminProductsController } = await import('../../controllers/admin-products.controller');
    controller = new AdminProductsController(mockAuth, mockProduct, mockUpload, mockSettings);
  });

  it('productList redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.productList(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('productList renders', async () => {
    sellerGuard();
    mockProduct.list.mockResolvedValue({ products: [{ id: 'p1', name: 'Product 1' }], page: 1, pages: 1 });
    mockProduct.getImages.mockResolvedValue([{ id: 'img1', url: '/img.png', isPrimary: true }]);
    const r = res();
    await controller.productList(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/products.ejs', expect.objectContaining({ pageTitle: 'Products — Admin' }));
  });

  it('productList handles search and pagination', async () => {
    sellerGuard();
    mockProduct.list.mockResolvedValue({ products: [], page: 2, pages: 5 });
    const r = res();
    await controller.productList(req({ query: { q: 'test', page: '2' } }), r);
    expect(mockProduct.list).toHaveBeenCalledWith({ search: 'test', page: 2 });
  });

  it('newProductForm redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.newProductForm(req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('newProductForm renders', async () => {
    sellerGuard();
    mockSettings.getMany.mockResolvedValue({ ai_enabled: 'false', ai_base_url: '', ai_api_key: '', ai_model: '', default_language: 'en' });
    const r = res();
    await controller.newProductForm(req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/product-form.ejs', expect.objectContaining({ pageTitle: 'New Product — Admin' }));
  });

  it('createProduct redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    const mockReq = { ...req(), parts: () => mockParts([]) };
    await controller.createProduct(mockReq, r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('createProduct renders form with validation error', async () => {
    sellerGuard();
    mockSettings.getMany.mockResolvedValue({ ai_enabled: 'false', ai_base_url: '', ai_api_key: '', ai_model: '', default_language: 'en' });
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'name', value: '' },
      ]),
    };
    await controller.createProduct(mockReq, r);
    expect(r.view).toHaveBeenCalledWith('admin/product-form.ejs', expect.objectContaining({ error: 'Name, price, and weight are required.' }));
  });

  it('createProduct creates product and redirects', async () => {
    sellerGuard();
    mockProduct.generateSlug.mockReturnValue('product-1');
    mockProduct.create.mockResolvedValue({ id: 'p1' });
    mockUpload.uploadBuffer.mockResolvedValue('https://img.url');
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'name', value: 'Product 1' },
        { type: 'field', fieldname: 'price', value: '10000' },
        { type: 'field', fieldname: 'weight', value: '500' },
        { type: 'field', fieldname: 'stock', value: '10' },
        { type: 'field', fieldname: 'isActive', value: '1' },
        { type: 'file', fieldname: 'images', toBuffer: async () => Buffer.from('data'), mimetype: 'image/png' },
      ]),
    };
    await controller.createProduct(mockReq, r);
    expect(mockProduct.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Product 1', price: 10000, weight: 500 }));
    expect(mockProduct.addImage).toHaveBeenCalledWith('p1', 'https://img.url', true);
    expect(r.redirect).toHaveBeenCalledWith('/admin/products', 302);
  });

  it('editProductForm redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.editProductForm('p1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('editProductForm returns 404 when not found', async () => {
    sellerGuard();
    mockProduct.getById.mockResolvedValue(null);
    const r = res();
    await controller.editProductForm('p1', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('editProductForm renders', async () => {
    sellerGuard();
    mockProduct.getById.mockResolvedValue({ id: 'p1', name: 'Product 1' });
    mockSettings.getMany.mockResolvedValue({ ai_enabled: 'false', ai_base_url: '', ai_api_key: '', ai_model: '', default_language: 'en' });
    const r = res();
    await controller.editProductForm('p1', req(), r);
    expect(r.view).toHaveBeenCalledWith('admin/product-form.ejs', expect.objectContaining({ pageTitle: 'Edit Product 1 — Admin' }));
  });

  it('updateProduct redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    const mockReq = { ...req(), parts: () => mockParts([]) };
    await controller.updateProduct('p1', mockReq, r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('updateProduct updates and redirects', async () => {
    sellerGuard();
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'name', value: 'Updated' },
        { type: 'field', fieldname: 'price', value: '20000' },
        { type: 'field', fieldname: 'weight', value: '600' },
        { type: 'field', fieldname: 'isActive', value: '1' },
      ]),
    };
    await controller.updateProduct('p1', mockReq, r);
    expect(mockProduct.update).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Updated', price: 20000 }));
    expect(r.redirect).toHaveBeenCalledWith('/admin/products', 302);
  });

  it('updateProduct handles image uploads', async () => {
    sellerGuard();
    mockUpload.uploadBuffer.mockResolvedValue('https://img.url');
    const r = res();
    const mockReq = {
      ...req(),
      parts: () => mockParts([
        { type: 'field', fieldname: 'name', value: 'Updated' },
        { type: 'field', fieldname: 'price', value: '20000' },
        { type: 'field', fieldname: 'weight', value: '600' },
        { type: 'file', fieldname: 'images', toBuffer: async () => Buffer.from('data'), mimetype: 'image/png' },
      ]),
    };
    await controller.updateProduct('p1', mockReq, r);
    expect(mockUpload.uploadBuffer).toHaveBeenCalled();
    expect(mockProduct.addImage).toHaveBeenCalledWith('p1', 'https://img.url', false);
    expect(r.redirect).toHaveBeenCalledWith('/admin/products', 302);
  });

  it('deleteProduct redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.deleteProduct('p1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('deleteProduct deletes and redirects', async () => {
    sellerGuard();
    const r = res();
    await controller.deleteProduct('p1', req(), r);
    expect(mockProduct.delete).toHaveBeenCalledWith('p1');
    expect(r.redirect).toHaveBeenCalledWith('/admin/products', 302);
  });

  it('deleteImage redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.deleteImage('p1', 'img1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('deleteImage deletes image record and file', async () => {
    sellerGuard();
    mockProduct.deleteImage.mockResolvedValue({ url: 'https://img.url' });
    const r = res();
    await controller.deleteImage('p1', 'img1', req(), r);
    expect(mockProduct.deleteImage).toHaveBeenCalledWith('img1');
    expect(mockUpload.deleteFile).toHaveBeenCalledWith('https://img.url');
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });

  it('deleteImage handles missing image record', async () => {
    sellerGuard();
    mockProduct.deleteImage.mockResolvedValue(null);
    const r = res();
    await controller.deleteImage('p1', 'img1', req(), r);
    expect(mockProduct.deleteImage).toHaveBeenCalledWith('img1');
    expect(mockUpload.deleteFile).not.toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });

  it('setPrimaryImage redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.setPrimaryImage('p1', 'img1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('setPrimaryImage sets and redirects', async () => {
    sellerGuard();
    const r = res();
    await controller.setPrimaryImage('p1', 'img1', req(), r);
    expect(mockProduct.setPrimaryImage).toHaveBeenCalledWith('p1', 'img1');
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });

  it('addVariant redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.addVariant('p1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('addVariant with name calls addVariant service', async () => {
    sellerGuard();
    const r = res();
    await controller.addVariant('p1', req({ body: { name: 'Size L', price: '15000', weight: '600', stock: '10' } }), r);
    expect(mockProduct.addVariant).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Size L', price: 15000 }));
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });

  it('addVariant without name skips service call', async () => {
    sellerGuard();
    const r = res();
    await controller.addVariant('p1', req({ body: {} }), r);
    expect(mockProduct.addVariant).not.toHaveBeenCalled();
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });

  it('deleteVariant redirects when not seller', async () => {
    mockAuth.verifyToken.mockReturnValue(null);
    const r = res();
    await controller.deleteVariant('p1', 'v1', req(), r);
    expect(r.redirect).toHaveBeenCalledWith('/auth/login', 302);
  });

  it('deleteVariant deletes and redirects', async () => {
    sellerGuard();
    const r = res();
    await controller.deleteVariant('p1', 'v1', req(), r);
    expect(mockProduct.deleteVariant).toHaveBeenCalledWith('v1');
    expect(r.redirect).toHaveBeenCalledWith('/admin/products/p1/edit', 302);
  });
});
