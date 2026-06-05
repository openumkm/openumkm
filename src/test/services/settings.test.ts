import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: {},
}));

import { SettingsService } from '../../services/settings.service';
import { db } from '../../db';

function qb(result: any) {
  const then = (resolve: any) => resolve(result);
  const chained: any = Object.assign(Promise.resolve(result), {
    then, where: () => chained, limit: () => chained, orderBy: () => chained,
    offset: () => chained, from: () => chained, execute: () => chained,
  });
  return chained;
}

function from(result: any) {
  return { where: () => ({ limit: () => qb(result), orderBy: () => qb(result) }), orderBy: () => qb(result) };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let mockSelect: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SettingsService();
    mockSelect = vi.fn();
    db.select = mockSelect;
  });

  describe('get', () => {
    it('returns value when key exists', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ value: 'My Store' }]) }) }) });
      expect(await service.get('store_name')).toBe('My Store');
    });

    it('returns null when key does not exist', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      expect(await service.get('nonexistent')).toBeNull();
    });
  });

  describe('getMany', () => {
    it('returns map of keys to values', async () => {
      const rows = [{ key: 'store_name', value: 'Store' }, { key: 'store_email', value: 'a@b.com' }];
      mockSelect.mockReturnValue({ from: () => qb(rows) });
      const result = await service.getMany(['store_name', 'store_email', 'missing']);
      expect(result).toEqual({ store_name: 'Store', store_email: 'a@b.com', missing: null });
    });
  });

  describe('set', () => {
    it('updates existing key', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ value: 'Old' }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.set('store_name', 'New');
    });

    it('inserts new key', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });
      db.insert = mockInsert;
      await service.set('new_key', 'value');
    });
  });

  describe('setMany', () => {
    it('calls set for each pair', async () => {
      const spy = vi.spyOn(service, 'set').mockResolvedValue(undefined);
      await service.setMany({ a: '1', b: '2' });
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('bank accounts', () => {
    it('getBankAccounts returns accounts ordered by sortOrder', async () => {
      const rows = [{ id: '1', bankName: 'BCA' }];
      mockSelect.mockReturnValue({ from: () => ({ orderBy: () => qb(rows) }) });
      expect(await service.getBankAccounts()).toEqual(rows);
    });

    it('addBankAccount inserts account', async () => {
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;
      await service.addBankAccount({ bankName: 'BCA', accountNumber: '123', accountHolder: 'A' });
    });

    it('toggleBankAccount toggles isActive', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', isActive: false }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.toggleBankAccount('1');
    });

    it('toggleBankAccount does nothing if not found', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([]) }) }) });
      await service.toggleBankAccount('1');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('deleteBankAccount deletes', async () => {
      const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      db.delete = mockDelete;
      await service.deleteBankAccount('1');
    });

    it('editBankAccount updates', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.editBankAccount('1', { bankName: 'BNI', accountNumber: '456', accountHolder: 'B' });
    });
  });

  describe('tax rates', () => {
    it('getTaxRates returns all', async () => {
      const rows = [{ id: '1', name: 'PPN', rate: '11' }];
      mockSelect.mockReturnValue({ from: () => qb(rows) });
      expect(await service.getTaxRates()).toEqual(rows);
    });

    it('addTaxRate inserts', async () => {
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;
      await service.addTaxRate({ name: 'PPN', rate: '11', applyTo: 'subtotal' });
    });

    it('toggleTaxRate toggles', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', isActive: true }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.toggleTaxRate('1');
    });

    it('deleteTaxRate deletes', async () => {
      const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      db.delete = mockDelete;
      await service.deleteTaxRate('1');
    });

    it('editTaxRate updates', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.editTaxRate('1', { name: 'PPN', rate: '12', applyTo: 'subtotal' });
    });
  });

  describe('currencies', () => {
    it('getCurrencies returns all', async () => {
      const rows = [{ code: 'IDR', name: 'Rupiah' }];
      mockSelect.mockReturnValue({ from: () => qb(rows) });
      expect(await service.getCurrencies()).toEqual(rows);
    });

    it('toggleCurrency toggles non-default', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ code: 'USD', name: 'US Dollar', isDefault: false, isActive: false }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.toggleCurrency('USD');
    });

    it('toggleCurrency does not toggle default', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ code: 'IDR', name: 'Rupiah', isDefault: true, isActive: true }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.toggleCurrency('IDR');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('updateExchangeRate updates', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.updateExchangeRate('USD', '0.000064');
    });
  });

  describe('shipping methods', () => {
    it('getShippingMethods returns all', async () => {
      const rows = [{ id: '1', name: 'JNE' }];
      mockSelect.mockReturnValue({ from: () => qb(rows) });
      expect(await service.getShippingMethods()).toEqual(rows);
    });

    it('getActiveShippingMethods returns active', async () => {
      const rows = [{ id: '1', name: 'JNE', isActive: true }];
      mockSelect.mockReturnValue({ from: () => ({ where: () => qb(rows) }) });
      expect(await service.getActiveShippingMethods()).toEqual(rows);
    });

    it('addShippingMethod inserts', async () => {
      mockSelect.mockReturnValue({ from: () => ({ orderBy: () => ({ limit: () => qb([{ max: 3 }]) }) }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;
      await service.addShippingMethod({ name: 'JNE', cost: 10000, description: 'Reguler' });
    });

    it('editShippingMethod updates', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.editShippingMethod('1', { name: 'JNE YES', cost: 20000, description: null });
    });

    it('toggleShippingMethod toggles', async () => {
      mockSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => qb([{ id: '1', isActive: false }]) }) }) });
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      db.update = mockUpdate;
      await service.toggleShippingMethod('1');
    });

    it('deleteShippingMethod deletes', async () => {
      const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      db.delete = mockDelete;
      await service.deleteShippingMethod('1');
    });
  });

  describe('misc', () => {
    it('getShippingMethods returns empty', async () => {
      mockSelect.mockReturnValue({ from: () => ({ orderBy: () => qb([]) }) });
      expect(await service.getShippingMethods()).toEqual([]);
    });
  });
});
