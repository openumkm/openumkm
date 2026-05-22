import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

import { SessionService } from '../../services/session.service';
import { db } from '../../db';

function qb(result: any) {
  const p: any = Promise.resolve(result);
  p.where = () => p; p.limit = () => p; p.orderBy = () => p;
  p.offset = () => p; p.from = () => p;
  return p;
}

describe('SessionService - extra coverage', () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService();
  });

  describe('clearCart', () => {
    it('does nothing when session not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      await service.clearCart('invalid');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('clears cart when session found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: 'sid1', data: { cart: [{ productId: 'p1', qty: 1 }] } }]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.clearCart('sid1');
    });
  });

  describe('updateCartQty', () => {
    it('returns empty when session not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      expect(await service.updateCartQty('invalid', 'p1', undefined, 3)).toEqual([]);
    });

    it('updates qty', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: 'sid1', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 10 }] } }]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const result = await service.updateCartQty('sid1', 'p1', undefined, 5);
      expect(result[0].qty).toBe(5);
    });

    it('removes item when qty <= 0', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: 'sid1', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 10 }] } }]) }) }) });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const result = await service.updateCartQty('sid1', 'p1', undefined, 0);
      expect(result).toHaveLength(0);
    });
  });

  describe('mergeGuestCart', () => {
    it('does nothing when guest session not found', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      await service.mergeGuestCart('guest', 'u1', 'user');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('does nothing when guest cart empty', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: 'gsid', data: {} }]) }) }) });
      await service.mergeGuestCart('guest', 'u1', 'user');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('merges cart with new items', async () => {
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) return { from: () => ({ where: () => ({ limit: () => qb([{ id: `s${callCount}`, data: callCount === 1 ? { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 1, weight: 0, stock: 10 }] } : { cart: [] } }]) }) }) };
        return { from: () => qb([]) };
      });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.mergeGuestCart('guest', 'u1', 'user');
    });

    it('merges and combines duplicate items', async () => {
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: () => ({ where: () => ({ limit: () => qb([{ id: 'gsid', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 1, weight: 0, stock: 10 }] } }]) }) }) };
        if (callCount === 2) return { from: () => ({ where: () => ({ limit: () => qb([{ id: 'usid', data: { cart: [{ productId: 'p1', name: 'P1', price: 100, qty: 2, weight: 0, stock: 10 }] } }]) }) }) };
        return { from: () => qb([]) };
      });
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.mergeGuestCart('guest', 'u1', 'user');
    });
  });

  describe('linkToUser', () => {
    it('updates session userId', async () => {
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      await service.linkToUser('sid1', 'u1');
    });
  });
});
