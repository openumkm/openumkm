import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { RevenueService } from '../../services/revenue.service';
import { db } from '../../db';

function qb(result: any) {
  const p: any = Promise.resolve(result);
  p.where = () => p; p.limit = () => p; p.orderBy = () => p;
  p.offset = () => p; p.from = () => p;
  return p;
}

/* ── ProductService ───────────────────────────── */
describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService();
  });

  describe('list', () => {
    const products = [{ id: '1', name: 'Test' }];

    it('lists products with search and active only', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => qb(products) }) }) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '1' }]) }) });
      const result = await service.list({ search: 'test', activeOnly: true, page: 1, limit: 10 });
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('lists products with sort', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => qb(products) }) }) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '1' }]) }) });
      const result = await service.list({ sort: 'price_asc' });
      expect(result.products).toHaveLength(1);
    });

    it('lists products with name_desc sort', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => qb(products) }) }) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '1' }]) }) });
      const result = await service.list({ sort: 'name_desc' });
      expect(result.products).toHaveLength(1);
    });
  });

  describe('getBySlug', () => {
    it('returns null when not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      expect(await service.getBySlug('nonexistent')).toBeNull();
    });

    it('returns product with images and variants', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', name: 'Test', slug: 'test' }]) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => qb([{ id: 'img1', url: 'a.jpg' }]) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ id: 'v1', name: 'Red' }]) }) });
      const result = await service.getBySlug('test');
      expect(result).toBeTruthy();
      expect(result!.images).toHaveLength(1);
      expect(result!.variants).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns null when not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      expect(await service.getById('nonexistent')).toBeNull();
    });

    it('returns product with images and variants', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', name: 'Test' }]) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => qb([]) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([]) }) });
      const result = await service.getById('1');
      expect(result).toBeTruthy();
    });
  });

  describe('getImages', () => {
    it('returns images for product', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => qb([{ id: 'i1', url: 'a.jpg' }]) }) }) });
      expect(await service.getImages('1')).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('creates product and returns it', async () => {
      const returning = vi.fn().mockResolvedValue([{ id: '1', name: 'New' }]);
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
      const result = await service.create({ name: 'New', slug: 'new', price: 1000, weight: 100, stock: 10 });
      expect(result.id).toBe('1');
    });
  });

  describe('update', () => {
    it('updates product', async () => {
      const returning = vi.fn().mockResolvedValue([{ id: '1', name: 'Updated' }]);
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
      const result = await service.update('1', { name: 'Updated' });
      expect(result.id).toBe('1');
    });
  });

  describe('delete', () => {
    it('deletes product', async () => {
      db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      await service.delete('1');
    });
  });

  describe('addImage', () => {
    it('adds image', async () => {
      const returning = vi.fn().mockResolvedValue([{ id: 'i1', url: 'a.jpg' }]);
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
      const result = await service.addImage('1', 'a.jpg', true);
      expect(result.id).toBe('i1');
    });
  });

  describe('setPrimaryImage', () => {
    it('sets primary image', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.setPrimaryImage('1', 'img1');
    });
  });

  describe('deleteImage', () => {
    it('deletes and returns image', async () => {
      const returning = vi.fn().mockResolvedValue([{ id: 'i1' }]);
      db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });
      const result = await service.deleteImage('i1');
      expect(result).toBeTruthy();
    });
  });

  describe('addVariant', () => {
    it('adds variant', async () => {
      const returning = vi.fn().mockResolvedValue([{ id: 'v1' }]);
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
      await service.addVariant('1', { name: 'Red', stock: 5 });
    });
  });

  describe('deleteVariant', () => {
    it('deletes variant', async () => {
      db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      await service.deleteVariant('v1');
    });
  });

  describe('deductStock', () => {
    it('deducts from variant when variantId provided', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.deductStock('1', 'v1', 2);
    });

    it('deducts from product when no variantId', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.deductStock('1', undefined, 1);
    });
  });

  describe('generateSlug', () => {
    it('generates slug from name', () => {
      expect(service.generateSlug('My Awesome Product!')).toBe('my-awesome-product');
    });
  });
});

/* ── OrderService ─────────────────────────────── */
describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderService();
  });

  describe('list', () => {
    it('lists orders with search and status', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => qb([{ id: '1', orderNumber: 'INV/001' }]) }) }) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '1' }]) }) });
      const result = await service.list({ search: 'INV', status: 'pending', page: 1 });
      expect(result.orders).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns null when not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      expect(await service.getById('nonexistent')).toBeNull();
    });

    it('returns order', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1' }]) }) }) });
      expect(await service.getById('1')).toBeTruthy();
    });
  });

  describe('generateOrderNumber', () => {
    it('generates order number', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => qb([{ value: 'INV' }]) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '5' }]) }) });
      const result = await service.generateOrderNumber();
      expect(result).toContain('INV/');
    });
  });

  describe('create', () => {
    it('creates order', async () => {
      vi.spyOn(service, 'generateOrderNumber').mockResolvedValue('INV/001');
      const returning = vi.fn().mockResolvedValue([{ id: 'o1', orderNumber: 'INV/001' }]);
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
      const result = await service.create({
        paymentMethod: 'manual_transfer', subtotal: 1000, taxTotal: 0,
        shippingCost: 0, total: 1000, currency: 'IDR', items: [], shippingAddress: {},
      });
      expect(result.orderNumber).toBe('INV/001');
    });
  });

  describe('updateStatus', () => {
    it('updates and restores stock for cancelled', async () => {
      const order = { id: 'o1', items: [{ productId: 'p1', variantId: 'v1', qty: 2 }] };
      const returning = vi.fn().mockResolvedValue([order]);
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
      const result = await service.updateStatus('o1', 'cancelled');
      expect(result).toBeTruthy();
    });

    it('updates and restores stock for expired (product-level)', async () => {
      const order = { id: 'o1', items: [{ productId: 'p1', qty: 2 }] };
      const returning = vi.fn().mockResolvedValue([order]);
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
      const result = await service.updateStatus('o1', 'expired');
      expect(result).toBeTruthy();
    });
  });

  describe('setTracking', () => {
    it('sets tracking info', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.setTracking('1', 'TRACK123');
    });
  });

  describe('updatePaymentInfo', () => {
    it('updates payment info', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.updatePaymentInfo('1', 'inv_123', 'https://pay.url');
    });
  });

  describe('checkExpiry', () => {
    it('returns order if not pending', async () => {
      const order = { id: '1', status: 'paid', expiresAt: new Date(0) } as any;
      const result = await service.checkExpiry(order);
      expect(result.status).toBe('paid');
    });

    it('expires order if past expiry', async () => {
      const order = { id: '1', status: 'pending', expiresAt: new Date(0), items: [] } as any;
      const returning = vi.fn().mockResolvedValue([{ ...order, status: 'expired' }]);
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
      const result = await service.checkExpiry(order);
      expect(result.status).toBe('expired');
    });
  });

  describe('listByCustomer', () => {
    it('lists customer orders', async () => {
      db.select = vi.fn()
        .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => qb([{ id: '1', customerId: 'u1' }]) }) }) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => qb([{ count: '1' }]) }) });
      const result = await service.listByCustomer('u1');
      expect(result.orders).toHaveLength(1);
    });
  });
});

/* ── RevenueService ───────────────────────────── */
describe('RevenueService', () => {
  let service: RevenueService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RevenueService();
  });

  it('getRevenueStats returns stats', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => qb([{ totalRevenue: '100000', totalOrders: '5' }]) }) });
    const result = await service.getRevenueStats('daily');
    expect(result.totalRevenue).toBe(100000);
    expect(result.totalOrders).toBe(5);
    expect(result.avgOrderValue).toBe(20000);
  });

  it('getRevenueStats handles zero orders', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => qb([{ totalRevenue: '0', totalOrders: '0' }]) }) });
    const result = await service.getRevenueStats('daily');
    expect(result.avgOrderValue).toBe(0);
  });

  it('getRevenueBreakdown returns breakdown', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ groupBy: () => qb([{ status: 'pending', count: '2' }, { status: 'paid', count: '3' }]) }) }) });
    const result = await service.getRevenueBreakdown('weekly');
    expect(result.pending).toBe(2);
    expect(result.paid).toBe(3);
    expect(result.cancelled).toBe(0);
  });
});
