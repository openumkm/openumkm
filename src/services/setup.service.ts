import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { db } from '../db';
import { users, settings, currencies } from '../db/schema';

const SALT_ROUNDS = 10;

const DEFAULT_SETTINGS: Record<string, string> = {
  store_name: 'My Store',
  store_email: '',
  store_phone: '',
  invoice_prefix: 'INV',
  default_language: 'id',
  xendit_enabled: 'false',
  manual_transfer_enabled: 'true',
  auto_expire_hours: '24',
  tax_enabled: 'false',
  smtp_enabled: 'false',
  ai_enabled: 'false',
};

const DEFAULT_CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchangeRate: '1.0', isDefault: true, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: '0.000063', isDefault: false, isActive: false },
];

@Injectable()
export class SetupService {
  async isSetupComplete(): Promise<boolean> {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length > 0;
  }

  async runSetup(data: { storeName: string; email: string; password: string }) {
    const alreadyDone = await this.isSetupComplete();
    if (alreadyDone) return { error: 'Setup already completed.' };

    // Create admin user
    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    await db.insert(users).values({
      email: data.email.toLowerCase(),
      passwordHash: hash,
      name: 'Admin',
      role: 'seller',
    });

    // Insert default settings
    const settingsToInsert = { ...DEFAULT_SETTINGS, store_name: data.storeName };
    const rows = Object.entries(settingsToInsert).map(([key, value]) => ({ key, value }));
    await db.insert(settings).values(rows);

    // Insert default currencies
    await db.insert(currencies).values(DEFAULT_CURRENCIES);

    return { success: true };
  }
}
