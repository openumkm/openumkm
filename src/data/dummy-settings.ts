/**
 * Dummy data for admin settings pages (UI-first development).
 */

export const dummySettings = {
  storeName: 'Swift Commerce',
  storeEmail: 'hello@swiftcommerce.id',
  storePhone: '+62 812 3456 7890',
  invoicePrefix: 'INV',
  defaultLanguage: 'id',
  logoUrl: null,

  xenditSecretKey: 'xnd_development_xxxxx',
  rajaOngkirApiKey: 'abc123def456',

  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUsername: 'noreply@swiftcommerce.id',
  smtpPassword: '••••••••',
  smtpFromAddress: 'noreply@swiftcommerce.id',
  smtpEnabled: true,

  xenditEnabled: true,
  manualTransferEnabled: true,
  autoExpireHours: 24,

  taxEnabled: true,

  seoTitle: 'Swift Commerce — Modern Online Store',
  seoDescription: 'Discover curated premium products at Swift Commerce.',
  seoOgImage: null,

  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: 'sk-xxxxx',
  aiModel: 'gpt-4o-mini',
  aiEnabled: false,

  originCity: 'Jakarta',
};

export const dummyCouriers = [
  { code: 'jne', name: 'JNE', enabled: true },
  { code: 'pos', name: 'POS Indonesia', enabled: false },
  { code: 'tiki', name: 'TIKI', enabled: true },
  { code: 'jnt', name: 'J&T Express', enabled: true },
  { code: 'sicepat', name: 'SiCepat', enabled: false },
  { code: 'anteraja', name: 'AnterAja', enabled: false },
  { code: 'ninja', name: 'Ninja Express', enabled: false },
  { code: 'idexpress', name: 'ID Express', enabled: false },
];

export const dummyBankAccounts = [
  { id: 'ba1', bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Swift Commerce', logoUrl: null, isActive: true, sortOrder: 1 },
  { id: 'ba2', bankName: 'Mandiri', accountNumber: '0987654321', accountHolder: 'Swift Commerce', logoUrl: null, isActive: true, sortOrder: 2 },
  { id: 'ba3', bankName: 'BNI', accountNumber: '1122334455', accountHolder: 'Swift Commerce', logoUrl: null, isActive: false, sortOrder: 3 },
];

export const dummyTaxRates = [
  { id: 'tx1', name: 'PPN', rate: 11.0, applyTo: 'subtotal', isActive: true },
  { id: 'tx2', name: 'Service Charge', rate: 5.0, applyTo: 'subtotal_shipping', isActive: false },
];

export const dummyCurrencies = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchangeRate: 1.0, isDefault: true, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.000063, isDefault: false, isActive: false },
];
