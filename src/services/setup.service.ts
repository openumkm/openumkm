import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { db } from '../db';
import { users, settings, currencies, bankAccounts } from '../db/schema';

const SALT_ROUNDS = 10;

const DEFAULT_CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchangeRate: '1.0', isDefault: true, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: '0.000063', isDefault: false, isActive: false },
];

export interface SetupData {
  // Admin account
  email: string;
  password: string;
  // Store info
  storeName: string;
  storeEmail?: string;
  storePhone?: string;
  defaultLanguage?: string;
  defaultCurrency?: string;
  invoicePrefix?: string;
  // Payment
  manualTransferEnabled?: boolean;
  xenditEnabled?: boolean;
  autoExpireHours?: number;
  // Optional first bank account
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
}

@Injectable()
export class SetupService {
  async isSetupComplete(): Promise<boolean> {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length > 0;
  }

  async runSetup(data: SetupData) {
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

    // Build settings
    const settingsMap: Record<string, string> = {
      store_name: data.storeName,
      store_email: data.storeEmail || '',
      store_phone: data.storePhone || '',
      invoice_prefix: data.invoicePrefix || 'INV',
      default_language: data.defaultLanguage || 'id',
      xendit_enabled: data.xenditEnabled ? 'true' : 'false',
      manual_transfer_enabled: data.manualTransferEnabled !== false ? 'true' : 'false',
      auto_expire_hours: String(data.autoExpireHours || 24),
      tax_enabled: 'false',
      smtp_enabled: 'false',
      ai_enabled: 'false',
      enabled_couriers: 'jne,tiki,jnt',
      seo_title: data.storeName,
      seo_description: '',
    };

    const rows = Object.entries(settingsMap).map(([key, value]) => ({ key, value }));
    await db.insert(settings).values(rows);

    // Insert currencies — set default based on selection
    const selectedCurrency = data.defaultCurrency || 'IDR';
    const currencyRows = DEFAULT_CURRENCIES.map((c) => ({
      ...c,
      isDefault: c.code === selectedCurrency,
      isActive: c.code === selectedCurrency ? true : c.isActive,
    }));
    await db.insert(currencies).values(currencyRows);

    // Insert first bank account if provided
    if (data.bankName && data.bankAccountNumber && data.bankAccountHolder) {
      await db.insert(bankAccounts).values({
        bankName: data.bankName,
        accountNumber: data.bankAccountNumber,
        accountHolder: data.bankAccountHolder,
        isActive: true,
        sortOrder: 1,
      });
    }

    return { success: true };
  }
}
