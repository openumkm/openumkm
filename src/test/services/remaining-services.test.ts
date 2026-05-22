import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

vi.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

import { SessionService } from '../../services/session.service';
import { AddressService } from '../../services/address.service';
import { PaymentConfirmationService } from '../../services/payment-confirmation.service';
import { db } from '../../db';

function qb(result: any) {
  const p: any = Promise.resolve(result);
  p.where = () => p; p.limit = () => p; p.orderBy = () => p;
  p.offset = () => p; p.from = () => p;
  return p;
}

/* ── SessionService ───────────────────────────── */
describe('SessionService', () => {
  let service: SessionService;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService();
    mockReq = { cookies: {} };
    mockRes = { setCookie: vi.fn() };
  });

  describe('getOrCreate', () => {
    it('creates new session when no cookie', async () => {
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      const result = await service.getOrCreate(mockReq, mockRes);
      expect(result.sessionId).toBe('mocked-uuid');
      expect(mockRes.setCookie).toHaveBeenCalled();
    });

    it('returns existing session when cookie is valid', async () => {
      mockReq.cookies.sid = 'existing-sid';
      const existing = { id: 'existing-sid', data: { cart: [{ productId: 'p1', qty: 1, price: 100, name: 'P1', weight: 0, stock: 10 }] } };
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([existing]) }) }) });
      const result = await service.getOrCreate(mockReq, mockRes, 'user-1');
      expect(result.sessionId).toBe('existing-sid');
    });

    it('creates new session when existing is expired', async () => {
      mockReq.cookies.sid = 'expired-sid';
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      const result = await service.getOrCreate(mockReq, mockRes);
      expect(result.sessionId).toBe('mocked-uuid');
    });
  });

  describe('update', () => {
    it('updates session data', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.update('sid1', { cart: [] });
    });
  });

  describe('getCart', () => {
    it('returns cart from session', async () => {
      vi.spyOn(service, 'getOrCreate').mockResolvedValue({
        sessionId: 'sid1',
        data: { cart: [{ productId: 'p1', qty: 2, price: 100, name: 'P', weight: 0, stock: 5 }] },
      });
      const result = await service.getCart(mockReq, mockRes);
      expect(result.cart).toHaveLength(1);
    });

    it('returns empty cart when no data', async () => {
      vi.spyOn(service, 'getOrCreate').mockResolvedValue({ sessionId: 'sid1', data: {} });
      const result = await service.getCart(mockReq, mockRes);
      expect(result.cart).toEqual([]);
    });
  });

  describe('addToCart', () => {
    it('adds new item to cart', async () => {
      const session = { id: 'sid1', data: {} };
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([session]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

      const item = { productId: 'p1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 10 };
      const result = await service.addToCart('sid1', item);
      expect(result).toHaveLength(1);
    });

    it('updates qty for existing item', async () => {
      const session = { id: 'sid1', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 1, weight: 0, stock: 10 }] } };
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([session]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

      const item = { productId: 'p1', name: 'P1', price: 100, qty: 3, weight: 0, stock: 10 };
      const result = await service.addToCart('sid1', item);
      expect(result[0].qty).toBe(4);
    });

    it('returns empty array when session not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      const result = await service.addToCart('invalid', {} as any);
      expect(result).toEqual([]);
    });
  });

  describe('removeFromCart', () => {
    it('removes item from cart', async () => {
      const session = { id: 'sid1', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 1, weight: 0, stock: 10 }, { productId: 'p2', name: 'P2', price: 200, qty: 1, weight: 0, stock: 5 }] } };
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([session]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const result = await service.removeFromCart('sid1', 'p1', undefined);
      expect(result).toHaveLength(1);
    });
  });

  describe('clearCart', () => {
    it('clears cart', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.clearCart('sid1');
    });
  });
});

/* ── AddressService ───────────────────────────── */
describe('AddressService', () => {
  let service: AddressService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AddressService();
  });

  it('listByUser returns addresses', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => qb([{ id: '1', label: 'Home' }]) }) }) });
    expect(await service.listByUser('u1')).toHaveLength(1);
  });

  it('getById returns null when not found', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
    expect(await service.getById('1', 'u1')).toBeNull();
  });

  it('getById returns address', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', label: 'Home' }]) }) }) });
    expect(await service.getById('1', 'u1')).toBeTruthy();
  });

  it('create inserts address', async () => {
    db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    const returning = vi.fn().mockResolvedValue([{ id: '1' }]);
    db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
    await service.create('u1', {
      label: 'Home', recipientName: 'A', phone: '081', addressLine: 'Jl. ABC',
      city: 'Jakarta', province: 'DKI', postalCode: '12345', isDefault: true,
    });
  });

  it('update modifies address', async () => {
    db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: '1' }]) }) }) });
    await service.update('1', 'u1', { label: 'New Home' });
  });

  it('delete removes address', async () => {
    db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    await service.delete('1', 'u1');
  });
});

/* ── PaymentConfirmationService ───────────────── */
describe('PaymentConfirmationService', () => {
  let service: PaymentConfirmationService;
  let mockOrderService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderService = { updateStatus: vi.fn(), getById: vi.fn() };
    service = new PaymentConfirmationService(mockOrderService);
  });

  it('list returns confirmations', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => qb([{ id: '1', status: 'pending' }]) }) }) });
    const result = await service.list('pending');
    expect(result).toHaveLength(1);
  });

  it('list without filter', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => qb([{ id: '1' }]) }) }) });
    const result = await service.list();
    expect(result).toHaveLength(1);
  });

  it('approve updates status and calls orderService', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'pc1', orderId: 'o1' }]);
    db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
    const result = await service.approve('pc1');
    expect(result).toBeTruthy();
    expect(mockOrderService.updateStatus).toHaveBeenCalledWith('o1', 'paid');
  });

  it('approve returns undefined when no pc', async () => {
    const returning = vi.fn().mockResolvedValue([]);
    db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }) });
    const result = await service.approve('pc1');
    expect(result).toBeUndefined();
  });

  it('reject updates status', async () => {
    db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    await service.reject('pc1', 'Invalid receipt');
  });

  it('create inserts confirmation', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'pc1' }]);
    db.insert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) });
    const result = await service.create({
      orderId: 'o1', senderBank: 'BCA', senderName: 'A',
      amount: 50000, transferDate: '2024-01-01', receiptImage: 'receipt.jpg',
    });
    expect(result).toBeTruthy();
  });

  it('getOrderByConfirmationId returns null when not found', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
    expect(await service.getOrderByConfirmationId('nonexistent')).toBeNull();
  });

  it('getOrderByConfirmationId returns order', async () => {
    db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ orderId: 'o1' }]) }) }) });
    mockOrderService.getById.mockResolvedValue({ id: 'o1' });
    const result = await service.getOrderByConfirmationId('pc1');
    expect(result).toEqual({ id: 'o1' });
  });
});
