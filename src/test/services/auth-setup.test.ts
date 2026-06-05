import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

vi.mock('bcrypt', () => ({ hash: vi.fn(), compare: vi.fn() }));
vi.mock('jsonwebtoken', () => ({ sign: vi.fn(), verify: vi.fn() }));

import { AuthService } from '../../services/auth.service';
import { SetupService } from '../../services/setup.service';
import { db } from '../../db';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

function qb(result: any) {
  const p: any = Promise.resolve(result);
  p.where = () => p; p.limit = () => p; p.orderBy = () => p;
  p.offset = () => p; p.from = () => p;
  return p;
}

/* ── AuthService ───────────────────────────────── */
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe('register', () => {
    it('returns error when email already exists', async () => {
      mockSelectWith([{ id: '1' }], true);
      const result = await service.register({ email: 'existing@test.com', password: '12345678', name: 'Test' });
      expect(result).toEqual({ error: 'Email already registered.' });
    });

    it('registers successfully', async () => {
      mockSelectWith([]);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hash' as never);
      const ins = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: '1', email: 'new@test.com', name: 'New', role: 'customer' }]) }) });
      db.insert = ins;
      const result = await service.register({ email: 'new@test.com', password: '12345678', name: 'New' });
      expect(result).toHaveProperty('user');
    });
  });

  function mockSelectWith(result: any, withLimit = false) {
    let chain = qb(result);
    if (withLimit) chain = { where: () => ({ limit: () => qb(result) }), from: () => chain };
    else chain = { where: () => ({ limit: () => qb(result) }), from: () => chain };
    db.select = vi.fn().mockReturnValue({ from: () => chain });
  }

  describe('login', () => {
    it('returns error when user not found', async () => {
      mockSelectWith([], true);
      const result = await service.login('nonexist@test.com', 'pass');
      expect(result).toEqual({ error: 'Invalid email or password.' });
    });

    it('returns error when password is wrong', async () => {
      mockSelectWith([{ id: '1', email: 'a@b.com', passwordHash: '$2b$10$hash', name: 'A', role: 'customer' }], true);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const result = await service.login('a@b.com', 'wrong');
      expect(result).toEqual({ error: 'Invalid email or password.' });
    });

    it('returns user and token on success', async () => {
      const user = { id: '1', email: 'a@b.com', passwordHash: '$2b$10$hash', name: 'A', role: 'customer' as const };
      mockSelectWith([user], true);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(jwt.sign).mockReturnValue('jwt-token' as never);
      const result = await service.login('a@b.com', 'pass');
      expect(result).toEqual({ user, token: 'jwt-token' });
    });
  });

  describe('signToken', () => {
    it('signs a JWT', () => {
      vi.mocked(jwt.sign).mockReturnValue('signed' as never);
      expect(service.signToken({ id: '1', email: 'a@b.com', role: 'seller' })).toBe('signed');
    });
  });

  describe('verifyToken', () => {
    it('returns payload for valid token', () => {
      const payload = { sub: '1', email: 'a@b.com', role: 'customer' };
      vi.mocked(jwt.verify).mockReturnValue(payload as never);
      expect(service.verifyToken('good')).toEqual(payload);
    });

    it('returns null for invalid token', () => {
      vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('bad'); });
      expect(service.verifyToken('bad')).toBeNull();
    });
  });

  describe('createResetToken', () => {
    it('returns null when user not found', async () => {
      mockSelectWith([], true);
      expect(await service.createResetToken('no@test.com')).toBeNull();
    });

    it('creates and returns token', async () => {
      mockSelectWith([{ id: '1' }], true);
      const ins = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ token: 'reset-tok' }]) }) });
      db.insert = ins;
      expect(await service.createResetToken('a@b.com')).toBeTruthy();
    });
  });

  describe('resetPassword', () => {
    it('returns error for invalid/expired token', async () => {
      mockSelectWith([], true);
      const result = await service.resetPassword('bad-token', 'newpass123');
      expect(result).toEqual({ error: 'Invalid or expired reset token.' });
    });

    it('resets password successfully', async () => {
      const future = new Date(Date.now() + 3600000);
      mockSelectWith([{ id: 'rt1', userId: 'u1', token: 'good', expiresAt: future }], true);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$newhash' as never);
      db.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const result = await service.resetPassword('good', 'newpass123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      mockSelectWith([{ id: '1', email: 'a@b.com', name: 'A' }], true);
      expect(await service.getUserById('1')).toBeTruthy();
    });

    it('returns null when not found', async () => {
      mockSelectWith([], true);
      expect(await service.getUserById('nonexistent')).toBeNull();
    });
  });

  describe('getUserCount', () => {
    it('returns 0 when no users', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([]) }) });
      expect(await service.getUserCount()).toBe(0);
    });

    it('returns count of users', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([{ id: '1' }]) }) });
      expect(await service.getUserCount()).toBe(1);
    });
  });
});

/* ── SetupService ──────────────────────────────── */
describe('SetupService', () => {
  let service: SetupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SetupService();
  });

  describe('isSetupComplete', () => {
    it('returns true when users exist', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([{ id: '1' }]) }) });
      expect(await service.isSetupComplete()).toBe(true);
    });

    it('returns false when no users', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([]) }) });
      expect(await service.isSetupComplete()).toBe(false);
    });
  });

  describe('runSetup', () => {
    it('returns error if already complete', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([{ id: '1' }]) }) });
      const result = await service.runSetup({ email: 'admin@test.com', password: 'pass1234', storeName: 'My Store' });
      expect(result).toEqual({ error: 'Setup already completed.' });
    });

    it('completes setup successfully', async () => {
      db.select = vi.fn().mockReturnValue({ from: () => ({ limit: () => qb([]) }) });
      vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hash' as never);

      let callCount = 0;
      db.insert = vi.fn().mockImplementation(() => {
        callCount++;
        const returning = vi.fn().mockResolvedValue(callCount === 1 ? [{ id: 'u1' }] : []);
        return { values: vi.fn().mockReturnValue({ returning }) };
      });

      const result = await service.runSetup({
        email: 'admin@test.com', password: 'pass1234', storeName: 'My Store',
        bankName: 'BCA', bankAccountNumber: '123456', bankAccountHolder: 'Admin',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
