import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── StorefrontController ─────────────────────── */
describe('StorefrontController', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockSession: any, mockSettings: any;

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn() };
    mockProduct = { list: vi.fn(), getBySlug: vi.fn(), getImages: vi.fn(), getById: vi.fn() };
    mockSession = { getCart: vi.fn() };
    mockSettings = { get: vi.fn() };
    const { StorefrontController } = await import('../../controllers/storefront.controller');
    controller = new StorefrontController(mockAuth, mockProduct, mockSession, mockSettings);
  });

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  it('homePage renders with search and sort', async () => {
    mockProduct.list.mockResolvedValue({ products: [{ id: '1', name: 'Test' }], page: 1, pages: 1 });
    mockProduct.getImages.mockResolvedValue([]);
    mockSession.getCart.mockResolvedValue({ cart: [] });
    mockSettings.get.mockResolvedValue('My Store');

    const r = res();
    await controller.homePage(req({ query: { q: 'test', page: '1', limit: '12', sort: 'price_asc' } }), r);
    expect(r.view).toHaveBeenCalledWith('storefront/home.ejs', expect.objectContaining({ pageTitle: 'My Store' }));
  });

  it('homePage without query params', async () => {
    mockProduct.list.mockResolvedValue({ products: [], page: 1, pages: 1 });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    mockSettings.get.mockResolvedValue(null);
    const r = res();
    await controller.homePage(req({ query: {} }), r);
    expect(r.view).toHaveBeenCalledWith('storefront/home.ejs', expect.objectContaining({ pageTitle: 'Store' }));
  });

  it('productDetailPage renders product', async () => {
    const product = { id: '1', name: 'Test', slug: 'test', images: [{ url: 'a.jpg' }], variants: [] };
    mockProduct.getBySlug.mockResolvedValue(product);
    mockProduct.list.mockResolvedValue({ products: [] });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.productDetailPage('test', req(), r);
    expect(r.view).toHaveBeenCalledWith('storefront/product-detail.ejs', expect.objectContaining({ pageTitle: expect.stringContaining('Test') }));
  });

  it('productDetailPage returns 404 when not found', async () => {
    mockProduct.getBySlug.mockResolvedValue(null);
    const r = res();
    await controller.productDetailPage('nonexistent', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

/* ── CartController ───────────────────────────── */
describe('CartController', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockSession: any, mockSettings: any, mockShipping: any;

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn() };
    mockProduct = { getById: vi.fn() };
    mockSession = { getCart: vi.fn(), getOrCreate: vi.fn(), addToCart: vi.fn(), removeFromCart: vi.fn(), updateCartQty: vi.fn() };
    mockSettings = { get: vi.fn() };
    mockShipping = { searchDestination: vi.fn(), calculateCost: vi.fn() };
    const { CartController } = await import('../../controllers/cart.controller');
    controller = new CartController(mockAuth, mockProduct, mockSession, mockSettings, mockShipping);
  });

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  it('cartAdd redirects to / when product not found', async () => {
    mockProduct.getById.mockResolvedValue(null);
    const r = res();
    await controller.cartAdd(req({ body: { productId: 'p1' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/', 302);
  });

  it('cartAdd redirects when stock is 0', async () => {
    mockProduct.getById.mockResolvedValue({ id: 'p1', slug: 'test', name: 'T', price: 100, stock: 0, weight: 0, images: [], variants: [] });
    const r = res();
    await controller.cartAdd(req({ body: { productId: 'p1', qty: '1' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/product/test', 302);
  });

  it('cartAdd adds to cart and redirects', async () => {
    mockProduct.getById.mockResolvedValue({ id: 'p1', slug: 'test', name: 'Test', price: 100, stock: 10, weight: 500, images: [{ url: 'a.jpg', isPrimary: true }], variants: [] });
    mockSession.getOrCreate.mockResolvedValue({ sessionId: 'sid1' });
    const r = res();
    await controller.cartAdd(req({ body: { productId: 'p1', qty: '2' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });

  it('cartAdd handles variant', async () => {
    mockProduct.getById.mockResolvedValue({ id: 'p1', slug: 'test', name: 'Test', price: 100, stock: 10, weight: 500, images: [{ url: 'a.jpg', isPrimary: true }], variants: [{ id: 'v1', name: 'Red', price: 150, stock: 5, weight: 600 }] });
    mockSession.getOrCreate.mockResolvedValue({ sessionId: 'sid1' });
    const r = res();
    await controller.cartAdd(req({ body: { productId: 'p1', variantId: 'v1', qty: '1' } }), r);
    expect(mockSession.addToCart).toHaveBeenCalled();
  });

  it('cartPage renders cart with stock changes', async () => {
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 5 }] });
    mockProduct.getById.mockResolvedValue({ id: 'p1', stock: 3, variants: [] });
    const r = res();
    await controller.cartPage(req(), r);
    expect(r.view).toHaveBeenCalledWith('storefront/cart.ejs', expect.objectContaining({ pageTitle: 'Shopping Cart' }));
  });

  it('cartPage handles variant stock changes', async () => {
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', variantId: 'v1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 5 }] });
    mockProduct.getById.mockResolvedValue({ id: 'p1', stock: 10, variants: [{ id: 'v1', stock: 1 }] });
    const r = res();
    await controller.cartPage(req(), r);
    expect(r.view).toHaveBeenCalled();
  });

  it('cartUpdate updates quantity', async () => {
    mockSession.getOrCreate.mockResolvedValue({ sessionId: 'sid1' });
    const r = res();
    await controller.cartUpdate(req({ body: { productId: 'p1', qty: '3' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });

  it('cartRemove removes item', async () => {
    mockSession.getOrCreate.mockResolvedValue({ sessionId: 'sid1' });
    const r = res();
    await controller.cartRemove(req({ body: { productId: 'p1' } }), r);
    expect(r.redirect).toHaveBeenCalledWith('/cart', 302);
  });
});

/* ── PaymentController ────────────────────────── */
describe('PaymentController', () => {
  let controller: any;
  let mockAuth: any, mockSession: any, mockSettings: any, mockOrder: any, mockPaymentConfirm: any, mockEmail: any, mockUpload: any;

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn() };
    mockSession = { getCart: vi.fn() };
    mockSettings = { getBankAccounts: vi.fn() };
    mockOrder = { getById: vi.fn(), updateStatus: vi.fn() };
    mockPaymentConfirm = { create: vi.fn() };
    mockEmail = { sendPaymentProofUploaded: vi.fn() };
    mockUpload = { uploadBuffer: vi.fn() };
    const { PaymentController } = await import('../../controllers/payment.controller');
    controller = new PaymentController(mockAuth, mockSession, mockSettings, mockOrder, mockPaymentConfirm, mockEmail, mockUpload);
  });

  function req(overrides = {}) {
    return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
  }
  function res() {
    return { view: vi.fn(), redirect: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  }

  it('paymentConfirmPage returns 404 when order not found', async () => {
    mockOrder.getById.mockResolvedValue(null);
    const r = res();
    await controller.paymentConfirmPage('o1', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('paymentConfirmPage renders form', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000 });
    mockSettings.getBankAccounts.mockResolvedValue([{ id: 'b1', isActive: true }]);
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.paymentConfirmPage('o1', req(), r);
    expect(r.view).toHaveBeenCalledWith('storefront/payment-confirmation.ejs', expect.objectContaining({ orderNumber: 'INV/001' }));
  });

  it('paymentConfirmSubmit returns 404 when order not found', async () => {
    mockOrder.getById.mockResolvedValue(null);
    const r = res();
    await controller.paymentConfirmSubmit('o1', req(), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('paymentConfirmSubmit processes multipart upload', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000 });
    mockSettings.getBankAccounts.mockResolvedValue([]);
    mockSession.getCart.mockResolvedValue({ cart: [] });
    mockUpload.uploadBuffer.mockResolvedValue('/uploads/receipts/r.jpg');

    const asyncParts = {
      [Symbol.asyncIterator]: () => {
        const parts = [
          { type: 'field', fieldname: 'senderBank', value: 'BCA' },
          { type: 'field', fieldname: 'senderName', value: 'John' },
          { type: 'field', fieldname: 'amount', value: '1000' },
          { type: 'field', fieldname: 'transferDate', value: '2024-01-01' },
          { type: 'file', fieldname: 'receiptImage', toBuffer: () => Buffer.from('data'), mimetype: 'image/jpeg' },
        ];
        let i = 0;
        return { next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) };
      },
    };
    const r = res();
    const reqWithParts = { ...req({}), parts: () => asyncParts };
    await controller.paymentConfirmSubmit('o1', reqWithParts, r);
    expect(mockPaymentConfirm.create).toHaveBeenCalled();
    expect(r.view).toHaveBeenCalledWith('storefront/payment-confirmation.ejs', expect.objectContaining({ success: true }));
  });

  it('paymentConfirmSubmit returns error when fields missing', async () => {
    mockOrder.getById.mockResolvedValue({ id: 'o1', orderNumber: 'INV/001', total: 1000 });
    mockSettings.getBankAccounts.mockResolvedValue([]);
    mockSession.getCart.mockResolvedValue({ cart: [] });

    const asyncParts = {
      [Symbol.asyncIterator]: () => {
        const parts = [{ type: 'field', fieldname: 'senderName', value: 'John' }];
        let i = 0;
        return { next: () => Promise.resolve({ value: parts[i], done: i++ >= parts.length }) };
      },
    };
    const r = res();
    const reqWithParts = { ...req({}), parts: () => asyncParts };
    await controller.paymentConfirmSubmit('o1', reqWithParts, r);
    expect(r.view).toHaveBeenCalledWith('storefront/payment-confirmation.ejs', expect.objectContaining({ error: expect.stringContaining('required') }));
  });
});
