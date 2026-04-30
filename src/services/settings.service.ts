import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { settings, bankAccounts, taxRates, currencies, shippingMethods } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class SettingsService {
  async get(key: string): Promise<string | null> {
    const [row] = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async getMany(keys: string[]): Promise<Record<string, string | null>> {
    const rows = await db.select().from(settings);
    const map: Record<string, string | null> = {};
    for (const k of keys) map[k] = null;
    for (const row of rows) {
      if (keys.includes(row.key)) map[row.key] = row.value;
    }
    return map;
  }

  async set(key: string, value: string) {
    const existing = await this.get(key);
    if (existing !== null) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async setMany(pairs: Record<string, string>) {
    for (const [key, value] of Object.entries(pairs)) {
      await this.set(key, value);
    }
  }

  // Bank accounts
  async getBankAccounts() {
    return db.select().from(bankAccounts).orderBy(bankAccounts.sortOrder);
  }

  async addBankAccount(data: { bankName: string; accountNumber: string; accountHolder: string; logoUrl?: string | null }) {
    await db.insert(bankAccounts).values(data);
  }

  async toggleBankAccount(id: string) {
    const [row] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
    if (row) {
      await db.update(bankAccounts).set({ isActive: !row.isActive }).where(eq(bankAccounts.id, id));
    }
  }

  async deleteBankAccount(id: string) {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async editBankAccount(id: string, data: { bankName: string; accountNumber: string; accountHolder: string; logoUrl?: string | null }) {
    await db.update(bankAccounts).set(data).where(eq(bankAccounts.id, id));
  }

  // Tax rates
  async getTaxRates() {
    return db.select().from(taxRates);
  }

  async addTaxRate(data: { name: string; rate: string; applyTo: 'subtotal' | 'subtotal_shipping' }) {
    await db.insert(taxRates).values(data);
  }

  async toggleTaxRate(id: string) {
    const [row] = await db.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
    if (row) {
      await db.update(taxRates).set({ isActive: !row.isActive }).where(eq(taxRates.id, id));
    }
  }

  async deleteTaxRate(id: string) {
    await db.delete(taxRates).where(eq(taxRates.id, id));
  }

  async editTaxRate(id: string, data: { name: string; rate: string; applyTo: 'subtotal' | 'subtotal_shipping' }) {
    await db.update(taxRates).set(data).where(eq(taxRates.id, id));
  }

  // Currencies
  async getCurrencies() {
    return db.select().from(currencies);
  }

  async toggleCurrency(code: string) {
    const [row] = await db.select().from(currencies).where(eq(currencies.code, code)).limit(1);
    if (row && !row.isDefault) {
      await db.update(currencies).set({ isActive: !row.isActive }).where(eq(currencies.code, code));
    }
  }

  async updateExchangeRate(code: string, rate: string) {
    await db.update(currencies).set({ exchangeRate: rate }).where(eq(currencies.code, code));
  }

  // Shipping methods (custom)
  async getShippingMethods() {
    return db.select()
      .from(shippingMethods)
      .orderBy(shippingMethods.sortOrder);
  }

  async getActiveShippingMethods() {
    return db.select()
      .from(shippingMethods)
      .where(eq(shippingMethods.isActive, true))
      .orderBy(shippingMethods.sortOrder);
  }

  async addShippingMethod(data: { name: string; cost: number; description?: string | null }) {
    const [maxRow] = await db.select({ max: shippingMethods.sortOrder })
      .from(shippingMethods)
      .orderBy(shippingMethods.sortOrder)
      .limit(1)
      .execute();
    const nextSort = (Number(maxRow?.max) || 0) + 1;
    await db.insert(shippingMethods).values({ ...data, sortOrder: nextSort, isActive: true });
  }

  async editShippingMethod(id: string, data: { name: string; cost: number; description?: string | null }) {
    await db.update(shippingMethods).set(data).where(eq(shippingMethods.id, id));
  }

  async toggleShippingMethod(id: string) {
    const [row] = await db.select().from(shippingMethods).where(eq(shippingMethods.id, id)).limit(1);
    if (row) {
      await db.update(shippingMethods).set({ isActive: !row.isActive }).where(eq(shippingMethods.id, id));
    }
  }

  async deleteShippingMethod(id: string) {
    await db.delete(shippingMethods).where(eq(shippingMethods.id, id));
  }
}
