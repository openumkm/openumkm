import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  pgEnum,
  json,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ── Enums ─────────────────────────────────────── */

export const userRoleEnum = pgEnum('user_role', ['customer', 'seller']);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'waiting_confirmation',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
  'expired',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'xendit',
  'manual_transfer',
]);

export const confirmationStatusEnum = pgEnum('confirmation_status', [
  'pending',
  'approved',
  'rejected',
]);

export const taxApplyToEnum = pgEnum('tax_apply_to', [
  'subtotal',
  'subtotal_shipping',
]);

/* ── Users ─────────────────────────────────────── */

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  role: userRoleEnum('role').notNull().default('customer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/* ── Password Reset Tokens ─────────────────────── */

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Sessions (cart data) ──────────────────────── */

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  data: json('data').$type<Record<string, unknown>>().default({}),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


/* ── Customer Addresses ────────────────────────── */

export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  addressLine: text('address_line').notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  province: varchar('province', { length: 255 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Products ──────────────────────────────────── */

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  price: integer('price').notNull(),
  weight: integer('weight').notNull(),
  stock: integer('stock').notNull().default(0),
  minOrder: integer('min_order').notNull().default(1),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  ogImage: varchar('og_image', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/* ── Product Images ────────────────────────────── */

export const productImages = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

/* ── Product Variants ──────────────────────────── */

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  size: varchar('size', { length: 50 }),
  color: varchar('color', { length: 50 }),
  price: integer('price'),
  weight: integer('weight'),
  stock: integer('stock').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Orders ────────────────────────────────────── */

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => users.id, { onDelete: 'set null' }),
  status: orderStatusEnum('status').notNull().default('pending'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  subtotal: integer('subtotal').notNull(),
  taxTotal: integer('tax_total').notNull().default(0),
  shippingCost: integer('shipping_cost').notNull().default(0),
  total: integer('total').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('IDR'),
  items: json('items').$type<unknown[]>().notNull(),
  shippingAddress: json('shipping_address').$type<Record<string, unknown>>().notNull(),
  courier: varchar('courier', { length: 50 }),
  courierService: varchar('courier_service', { length: 50 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  paymentInvoiceId: varchar('payment_invoice_id', { length: 255 }),
  paymentUrl: varchar('payment_url', { length: 500 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


/* ── Payment Confirmations ─────────────────────── */

export const paymentConfirmations = pgTable('payment_confirmations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }).unique(),
  senderBank: varchar('sender_bank', { length: 100 }).notNull(),
  senderName: varchar('sender_name', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  transferDate: date('transfer_date').notNull(),
  receiptImage: varchar('receipt_image', { length: 500 }).notNull(),
  notes: text('notes'),
  status: confirmationStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

/* ── Bank Accounts ─────────────────────────────── */

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  accountHolder: varchar('account_holder', { length: 255 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Tax Rates ─────────────────────────────────── */

export const taxRates = pgTable('tax_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),
  applyTo: taxApplyToEnum('apply_to').notNull().default('subtotal'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Currencies ────────────────────────────────── */

export const currencies = pgTable('currencies', {
  code: varchar('code', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 }).notNull().default('1.0'),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ── Settings (key-value) ──────────────────────── */

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
});
