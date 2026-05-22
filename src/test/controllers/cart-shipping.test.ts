import { describe, it, expect, vi, beforeEach } from 'vitest';

function req(overrides = {}) {
  return { t: (k: string) => k, lang: 'en', currency: 'IDR', currencies: [], cookies: {}, query: {}, body: {}, ...overrides };
}
function res() {
  return { send: vi.fn(), redirect: vi.fn(), view: vi.fn(), status: vi.fn().mockReturnThis() } as any;
}

/* ── CartController shipping endpoints ────────── */
describe('CartController - shipping', () => {
  let controller: any;
  let mockAuth: any, mockProduct: any, mockSession: any, mockSettings: any, mockShipping: any;

  beforeEach(async () => {
    mockAuth = { verifyToken: vi.fn() };
    mockProduct = { getById: vi.fn() };
    mockSession = { getOrCreate: vi.fn(), getCart: vi.fn() };
    mockSettings = { get: vi.fn(), getActiveShippingMethods: vi.fn() };
    mockShipping = { searchDestination: vi.fn(), calculateCost: vi.fn() };
    const { CartController } = await import('../../controllers/cart.controller');
    controller = new CartController(mockAuth, mockProduct, mockSession, mockSettings, mockShipping);
  });

  it('shippingSearch returns empty when query too short', async () => {
    const r = res();
    await controller.shippingSearch(req({ query: { q: 'a' } }), r);
    expect(r.send).toHaveBeenCalledWith({ results: [] });
  });

  it('shippingSearch returns results', async () => {
    mockShipping.searchDestination.mockResolvedValue([{ id: '1', label: 'Jakarta' }]);
    const r = res();
    await controller.shippingSearch(req({ query: { q: 'Jakarta' } }), r);
    expect(r.send).toHaveBeenCalledWith({ results: [{ id: '1', label: 'Jakarta' }] });
  });

  it('shippingCalculate returns error when no destination', async () => {
    const r = res();
    await controller.shippingCalculate(req({ body: {} }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Destination not selected.' }));
  });

  it('shippingCalculate returns custom services', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'custom';
      if (k === 'rajaongkir_enabled') return 'false';
      return null;
    });
    mockSettings.getActiveShippingMethods.mockResolvedValue([{ name: 'JNE', description: 'Reguler', cost: 10000 }]);
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '1' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ services: expect.arrayContaining([expect.objectContaining({ courier: 'JNE' })]) }));
  });

  it('shippingCalculate returns error when no custom methods', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'custom';
      if (k === 'rajaongkir_enabled') return 'false';
      return null;
    });
    mockSettings.getActiveShippingMethods.mockResolvedValue([]);
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '1' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ services: [] }));
  });

  it('shippingCalculate handles rajaongkir with no origin', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'rajaongkir';
      if (k === 'rajaongkir_enabled') return 'true';
      if (k === 'origin_city') return null;
      return null;
    });
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '1' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Origin city not configured. Please contact the seller.' }));
  });

  it('shippingCalculate handles zero weight cart', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'rajaongkir';
      if (k === 'rajaongkir_enabled') return 'true';
      if (k === 'origin_city') return '1';
      return null;
    });
    mockSession.getCart.mockResolvedValue({ cart: [] });
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '2' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unable to calculate shipping — cart has no weight.' }));
  });

  it('shippingCalculate returns rajaongkir services', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'rajaongkir';
      if (k === 'rajaongkir_enabled') return 'true';
      if (k === 'origin_city') return '1';
      return null;
    });
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', weight: 500, qty: 1 }] });
    mockShipping.calculateCost.mockResolvedValue([{ courier: 'JNE', service: 'REG', cost: 10000, description: 'Reguler', etd: '1-2' }]);
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '2' } }), r);
    expect(r.send).toHaveBeenCalledWith({ services: [{ courier: 'JNE', service: 'REG', cost: 10000, description: 'Reguler', etd: '1-2' }] });
  });

  it('shippingCalculate handles rajaongkir empty with custom fallback', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'both';
      if (k === 'rajaongkir_enabled') return 'true';
      if (k === 'origin_city') return '1';
      return null;
    });
    mockSettings.getActiveShippingMethods.mockResolvedValue([{ name: 'JNE', description: 'Reguler', cost: 10000 }]);
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', weight: 500, qty: 1 }] });
    mockShipping.calculateCost.mockResolvedValue([]);
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '2' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ services: expect.arrayContaining([expect.objectContaining({ courier: 'JNE' })]) }));
  });

  it('shippingCalculate returns error when no services at all', async () => {
    mockSettings.get.mockImplementation((k: string) => {
      if (k === 'shipping_mode') return 'rajaongkir';
      if (k === 'rajaongkir_enabled') return 'true';
      if (k === 'origin_city') return '1';
      return null;
    });
    mockSession.getCart.mockResolvedValue({ cart: [{ productId: 'p1', weight: 500, qty: 1 }] });
    mockShipping.calculateCost.mockResolvedValue([]);
    const r = res();
    await controller.shippingCalculate(req({ body: { destination: '2' } }), r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'No shipping services available for this destination. Please try a different location.' }));
  });
});
