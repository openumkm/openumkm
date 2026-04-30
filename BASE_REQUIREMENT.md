# Lightweight eCommerce Engine — Technical Specification

## Objective

Build a **self-hosted eCommerce engine** optimized for:

* 1 vCPU
* 1GB RAM
* Single-node deployment (Pod-based: Sumopod / Pikapod)

Design goals:

* Minimal resource usage
* Fast startup
* Simple architecture
* Production-stable for small sellers

---

# 1. High-Level Architecture

## Topology

```
[ Client (Browser) ]
        ↓
[ App Container (FE + BE) ]
        ↓
[ PostgreSQL Container ]
```

## Containers

* **app**: Node.js runtime (Backend + Frontend rendering)
* **db**: PostgreSQL (tuned for low memory)

---

# 2. Tech Stack

## Backend

* Framework: NestJS (lean configuration)
* HTTP Adapter: Fastify

### Rules

* Avoid heavy decorators and interceptors
* Avoid global pipes unless necessary
* Keep modules flat and simple

---

## ORM / Database Layer

* ORM: Drizzle ORM
* Query style: SQL-first

### Rules

* Avoid abstraction layers
* Prefer explicit queries
* Minimize joins unless necessary

---

## Database

* PostgreSQL (Alpine or Slim image)

### Required Tuning

```
shared_buffers = 128MB
work_mem = 4MB
max_connections = 20
effective_cache_size = 256MB
```

---

## Frontend

* Template engine: **EJS**
* Server-side rendering only

### Rules

* No React runtime
* No hydration
* No client-heavy JS (minimal JS only for UX interactions like cart toggle, form validation)

---

## Storage

* **Default**: Docker volume mount (`./uploads` → container `/app/uploads`)
* **Optional**: S3-compatible (MinIO / Cloudflare R2) via env config

### Env Config

```
STORAGE_TYPE=local              # "local" or "s3"
S3_ENDPOINT=                    # optional
S3_BUCKET=                      # optional
S3_ACCESS_KEY=                  # optional
S3_SECRET_KEY=                  # optional
```

### Rules

* Do NOT store images in DB
* Images served via static file handler (local) or presigned URL (S3)
* Max file size: 5MB per image

---

## Authentication

* JWT-based auth
* Email + password only
* No OAuth

### Roles

* `customer` — browse, cart, checkout, order history, manage addresses
* `seller` — admin panel access (products, orders, settings)

### Rules

* No RBAC system beyond these two roles
* Guest checkout allowed (no account required)

---

## Payment

* Xendit (single gateway initially)
* API key configurable via admin panel

---

## Shipping

* RajaOngkir
* API key configurable via admin panel

---

# 3. Project Structure

```
/app
  /modules
    /auth
    /product
    /order
    /checkout
    /payment
    /address
    /settings
    /shipping
    /tax
    /currency
    /seo
    /ai

  /db
    schema.ts
    migrations/

  /views
    /storefront
    /admin
    /auth
    /emails
    /partials

  /locales
    /id
      storefront.json
      admin.json
      emails.json
      common.json
    /en
      storefront.json
      admin.json
      emails.json
      common.json

  /public
    /assets
    /uploads          (volume mount for local storage)

  /mail
    templates/        (EJS email templates)

  main.ts
  config.ts
  setup.guard.ts
```

### Rules

* No deep nesting
* No domain-driven layering
* Keep modules isolated but simple

---

# 4. Core Modules

## 4.1 Product

* Create / update / delete product (admin only)
* Product fields:
  * name
  * slug (auto-generated from name)
  * description (supports AI generation)
  * price (in default currency smallest unit, e.g. rupiah)
  * weight (grams, required for shipping calculation)
  * stock
  * min_order (minimum purchase qty, default 1)
  * images (multiple, via storage module)
  * is_active (soft archive)
* Variants (optional):
  * size, color
  * variant-specific price override
  * variant-specific stock
  * variant-specific weight (nullable, inherit product weight if null)
* SEO Meta (optional, per product):
  * meta_title
  * meta_description
  * og_image (nullable, falls back to primary product image)
  * Support AI generation for meta fields
* Out of stock behavior:
  * Stock 0 tetap tampil dengan label "Habis" / "Out of Stock"
  * Tidak bisa di-checkout (tombol disabled)
* Stock deduction:
  * Stok dipotong saat order dibuat (status `pending`)
  * Jika order expired / cancelled → stok otomatis kembali

---

## 4.2 Cart

* Session-based cart (no persistent cart required)
* Cart stored in server-side session (DB-backed)
* Add / remove / update quantity
* Cart logic:
  * Guest cart persists 14 days (unless checked out)
  * Guest → login: cart otomatis merge (guest items + user items, duplicate produk = update qty)
  * Cart cleared after successful order
  * Stock 0 items cannot be added to cart
  * If stock changes while item in cart, show warning on cart page

---

## 4.3 Checkout

* Support both: **guest** and **logged-in** customer

### Guest Fields

* Name
* Email (optional, for receipt)
* Phone
* Address (inline: full address + city + postal code + province)

### Logged-in Fields

* Select from saved addresses
* Or add new address inline

### Shipping

* Calculate cost via RajaOngkir based on destination city

---

## 4.4 Order

* Create order record
* Store:

  * customer_id (nullable, for guest)
  * order_number (human-readable, e.g. `INV/20260430/001`)
  * items (JSON: product snapshot + qty + price)
  * subtotal
  * tax_total
  * shipping_cost
  * total
  * status
  * shipping_address (JSON snapshot)
  * payment_method (enum: `xendit`, `manual_transfer`)
  * payment_invoice_id (Xendit, nullable)
  * payment_confirmation_id (manual transfer, nullable)
  * expires_at (auto-set based on seller config, default 24 hours)
  * currency (e.g. `IDR`, `USD`)

Statuses:

* `pending` — order created, awaiting payment
* `waiting_confirmation` — manual transfer, buyer uploaded proof, awaiting seller review
* `paid` — payment confirmed (Xendit webhook OR seller approved manual proof)
* `processing` — seller accepted
* `shipped` — shipped with tracking
* `completed` — delivered
* `cancelled` — cancelled by seller
  * cancelled → stok kembali
* `expired` — payment deadline exceeded
  * expired → stok kembali
  * Checked on view page / admin dashboard access (no background worker)
  * Seller configures auto-expire hours in settings (default: 24)

### Order Number Format

```
{prefix}/{YYYYMMDD}/{sequence}
```

* prefix: `INV` (configurable in settings)
* sequence: daily counter, padded to 3 digits (e.g. `001`, `002`)
* Example: `INV/20260430/001`

---

## 4.5 Payment

### Xendit Integration

* Create invoice via Xendit
* Handle callback / webhook from Xendit for status update
* Seller can enable/disable Xendit in settings
* Payment methods: any that Xendit supports (seller chooses which to activate)

### Manual Bank Transfer

* Seller configures bank accounts in admin settings
* Each bank account:
  * Bank name (e.g. "BCA", "Mandiri")
  * Account number
  * Account holder name
  * Bank logo (optional, uploaded image)
  * Is active toggle

* At checkout, buyer sees:
  * Total amount to pay
  * List of available bank accounts (name, number, holder)
  * Transfer deadline (24 hours from order creation)
  * Upload proof button (after order created)

### Payment Confirmation (Manual Transfer)

* Buyer uploads transfer receipt after sending payment
* Fields:
  * Sender bank name
  * Sender account name
  * Transfer amount
  * Transfer date
  * Receipt image upload
  * Notes (optional)

* After upload, order status → `waiting_confirmation`
* Seller reviews proof in admin panel → approve → `paid`, or reject (with reason note)
* If not confirmed within 24 hours, order auto-cancelled (check on view / admin access)

### Payment Flow

1. Checkout → buyer selects: Xendit or Manual Transfer
2. **Xendit path**: Redirect to Xendit → webhook → `paid`
3. **Manual path**: Order created → buyer uploads proof → `waiting_confirmation` → seller approve → `paid`

---

## 4.6 Shipping

* Calculate cost via RajaOngkir (origin → destination)
* Seller configures which couriers to enable in admin settings
* Supported couriers (toggle per courier):
  * `jne` — JNE (REG, YES, OKE)
  * `pos` — POS Indonesia
  * `tiki` — TIKI (REG, ONS, ECO)
  * `jnt` — J&T
  * `sicepat` — SiCepat
  * `anteraja` — AnterAja
  * `ninja` — Ninja Express
  * `idexpress` — ID Express
* Show only enabled couriers at checkout
* Store chosen courier + service in order
* Optional: input tracking number (admin)

---

## 4.7 Address (Customer)

* Customer can manage multiple addresses
* Fields:
  * label (e.g. "Rumah", "Kantor")
  * recipient_name
  * phone
  * address_line
  * city
  * province
  * postal_code
  * is_default
* CRUD via customer dashboard

---

## 4.8 Settings (Admin)

* Store info:
  * Store name, email, phone
  * Logo (optional)
  * Invoice prefix (default: `INV`)
  * Default language (`id` / `en`)
* API Keys:
  * Xendit Secret Key
  * RajaOngkir API Key
* SMTP Config:
  * Host
  * Port
  * Username
  * Password
  * From address (sender)
  * Enabled toggle (on/off)
* Payment Methods:
  * Xendit: enable/disable
  * Manual Transfer: enable/disable
  * Auto-expire hours (default 24)
* Bank Accounts (manual transfer):
  * CRUD list of bank accounts (bank name, account number, holder, logo, active)
* Shipping Couriers:
  * Toggle list (JNE, POS, TIKI, J&T, SiCepat, AnterAja, Ninja, ID Express)
* Tax Rates:
  * CRUD list (name, rate %, apply_to, active)
  * Global tax enable/disable toggle
* Currency:
  * Available currencies list (IDR, USD)
  * Toggle active per currency
  * Set default currency
  * Set exchange rate (manual input)
* SEO:
  * Store meta title
  * Store meta description
  * OG image
* AI Configuration:
  * API Base URL (OpenAI-compatible)
  * API Key
  * Model name
  * Enable/disable toggle
* Storage config (if S3)
* Origin city (dropdown from RajaOngkir, for shipping calculation)

---

## 4.9 Email Notification

* Sends email using configured SMTP
* No background workers — sent synchronously on single order
* No queue, no retry — keep it simple

### Trigger Events

| Event | To | Template |
|---|---|---|
| Order created (Xendit) | Customer | Order confirmation + payment link |
| Order created (Manual) | Customer | Order confirmation + bank transfer instructions |
| Payment proof uploaded | Seller | New payment confirmation to review |
| Payment confirmed (paid) | Customer + Seller | Payment confirmed |
| Payment rejected | Customer | Rejection notice + reason |
| Order shipped | Customer | Shipping confirmation + tracking number |
| Order cancelled | Customer | Cancellation notice |

* All emails rendered via EJS templates from `/mail/templates`

---

## 4.10 Admin Dashboard (Revenue)

* Basic revenue stats, no chart library — rendered as HTML table
* Aggregated via SQL query (`SUM(total)` from orders where status != 'cancelled')

### Report Periods

| Period | Query |
|---|---|
| Daily | Today only |
| Weekly | Last 7 days |
| Monthly | Last 30 days |
| Yearly | Last 365 days |

### Displayed Data per Period

* Total revenue
* Total orders
* Average order value
* Breakdown by status (count)

---

## 4.11 Tax

* Configurable tax rates (admin settings)
* Seller can enable/disable tax globally
* Support multiple tax types:
  * PPN (e.g. 11%)
  * Service charge
  * Custom tax

### Tax Fields

* Name (e.g. "PPN")
* Rate (percentage, e.g. 11)
* Is active toggle
* Applied to: subtotal or subtotal + shipping

### Tax Calculation at Checkout

```
subtotal → apply tax(s) → tax_total → + shipping → = grand total
```

* Tax stored in order as `tax_total` (integer)

---

## 4.12 Currency

* Multi-currency support
* Seller selects default currency and available currencies
* Supported currencies (initial):
  * IDR (Indonesian Rupiah)
  * USD (US Dollar)
* Price display follows selected currency
* Currency switch via UI dropdown or auto-detect (optional)
* Exchange rate: manual input by seller in settings (not live fetching)
* Order stores the currency used at checkout time

---

## 4.13 SEO

* Store-level SEO:
  * Homepage title
  * Homepage meta description
  * Store logo (OG image)
* Product-level SEO (optional per product):
  * Override meta_title
  * Override meta_description
  * OG image (falls back to primary product image)
* All meta fields support AI generation
* Rendered in `<head>` of EJS templates
* Simple, no sitemap generation in v1

---

## 4.14 AI (Content Generator)

* OpenAI-compatible API integration
* Seller inputs in admin settings:
  * API Base URL (OpenAI-compatible endpoint)
  * API Key
  * Model name (e.g. `gpt-4o-mini`, `meta-llama/llama-3`)
* AI can generate:
  * Product description
  * Product meta title
  * Product meta description
  * Store description
  * Store meta title / description
  * Any text input field in admin forms

### AI UI Pattern

* "Generate with AI" button next to relevant form fields
* Opens inline prompt: brief instruction → result fills the field
* Simple, no chat interface — single generation per click
* Prompt language follows admin's selected language

---

## 4.15 Localization (i18n)

* Bilingual: **Bahasa Indonesia** + **English**
* Seller selects default language in settings
* Language switcher on storefront (ID | EN)
* Translation system:
  * Key-value JSON files per language
  * EJS templates use translation keys
  * DB content (product names, descriptions) — single language, no translation storage
  * UI strings only (buttons, labels, messages, emails)
* Extensible: add new language by adding a single JSON file

### Translation File Structure

```
/locales
  /id
    storefront.json
    admin.json
    emails.json
  /en
    storefront.json
    admin.json
    emails.json
```

---

# 5. Setup / Onboarding

## First Install Flow

1. App starts fresh (no users in DB)
2. All requests redirect to `/setup` onboarding page
3. Setup form:
   * Super admin email
   * Super admin password
   * Store name
4. On submit → create super admin user + default settings
5. Redirect to admin dashboard

### Rules

* `/setup` route accessible only when no users exist
* After setup complete, `/setup` returns 404
* Env variable `SETUP_SECRET` can lock setup page (optional)

---

## Forgot Password

* Login page → "Forgot Password" link
* User enters email → system sends reset link via SMTP
* Reset token: UUID, valid 1 hour, stored in DB
* Reset page: enter new password → confirm → redirect to login
* If SMTP not configured, show appropriate message

---

# 6. Pages / Routes

## Setup (no users exist)

```
GET  /setup                     Onboarding form
POST /setup                     Create super admin + complete setup
```

## Storefront

```
GET  /                          Home / Product listing (search: ?q=, pagination: ?page=&limit=, sort: ?sort=price_asc|price_desc)
GET  /product/:slug              Product detail
GET  /?lang=id                    Switch language (ID/EN)
POST /cart/add                   Add to cart (session)
GET  /cart                       View cart
POST /cart/update                Update qty
POST /cart/remove                Remove item
GET  /checkout                   Checkout form
POST /checkout/submit            Submit order
GET  /checkout/success/:id       Order confirmed + payment instructions
GET  /payment/confirm/:id        Payment confirmation form (manual transfer)
POST /payment/confirm/:id        Upload transfer proof
GET  /auth/login                 Login page
POST /auth/login                 Login action
GET  /auth/register              Register page
POST /auth/register              Register action
GET  /auth/forgot-password       Forgot password form
POST /auth/forgot-password       Send reset link
GET  /auth/reset-password/:token Reset password form
POST /auth/reset-password/:token Set new password
GET  /auth/logout                Logout
GET  /dashboard                  Customer dashboard
GET  /dashboard/orders           Order history (pagination)
GET  /dashboard/orders/:id       Order detail
GET  /dashboard/addresses        Address list
POST /dashboard/addresses        Add address
POST /dashboard/addresses/:id    Edit address
POST /dashboard/addresses/:id/delete  Delete address
```

## Admin (`/admin`)

```
GET  /admin                      Dashboard (revenue stats)
GET  /admin/revenue?period=      Revenue breakdown (daily/weekly/monthly/yearly)
GET  /admin/products             Product list (search: ?q=, pagination: ?page=&limit=)
GET  /admin/products/new         New product form
POST /admin/products             Create product
GET  /admin/products/:id/edit    Edit product form
POST /admin/products/:id         Update product
POST /admin/products/:id/delete  Delete / archive product
GET  /admin/orders               Order list (filter: ?status=, search: ?q=, pagination)
GET  /admin/orders/:id           Order detail
POST /admin/orders/:id/status    Update order status (triggers email)
POST /admin/orders/:id/tracking  Add tracking number (triggers email)
GET  /admin/payments/confirmations  List payment confirmations to review
POST /admin/payments/:id/approve    Approve transfer proof → status `paid`
POST /admin/payments/:id/reject     Reject transfer proof (with reason note)
GET  /admin/settings             Settings form
POST /admin/settings             Save settings (store info, API keys, SMTP, payment methods, couriers, currency, tax, SEO, AI)
GET  /admin/settings/bank-accounts   Bank account list
POST /admin/settings/bank-accounts   Add bank account
POST /admin/settings/bank-accounts/:id      Edit bank account
POST /admin/settings/bank-accounts/:id/toggle  Toggle active
POST /admin/settings/bank-accounts/:id/delete  Delete bank account
GET  /admin/settings/taxes       Tax rates list
POST /admin/settings/taxes       Add tax rate
POST /admin/settings/taxes/:id   Edit tax rate
POST /admin/settings/taxes/:id/toggle  Toggle active
POST /admin/settings/taxes/:id/delete   Delete tax rate
GET  /admin/settings/currencies  Currency list
POST /admin/settings/currencies/toggle  Toggle currency active
POST /admin/settings/currencies/:code/rate  Update exchange rate
POST /admin/ai/generate          AI generate content (AJAX endpoint, returns generated text)
```

---

# 6. Request Flow

## Product Page

1. Request hits NestJS
2. Query DB via Drizzle
3. Render HTML (EJS)
4. Return response

---

## Checkout Flow (Guest)

1. User fills form (name, phone, address, etc.)
2. Backend validates form
3. Fetch shipping cost (RajaOngkir based on destination city)
4. Calculate total: subtotal → apply tax → add shipping → grand total
5. Deduct stock from products (lock until order expires/paid)
6. Create order (customer_id = null) with `expires_at` = now + seller-configured hours
7. Buyer selects payment method:

   **Xendit path:**
   8. Call Xendit API → create invoice
   9. Redirect user to Xendit payment page
   10. Xendit webhook → update order status to `paid`
   11. Send email notification (payment confirmed)

   **Manual Transfer path:**
   8. Show bank transfer instructions (bank list + amount)
   9. Buyer uploads transfer proof → status `waiting_confirmation`
   10. Notify seller via email (new confirmation to review)
   11. Seller approves → status `paid` + email notification to buyer

**Expiry:**
- If `expires_at` passed and status is `pending` → auto-toggle to `expired` on next view
- `expired` → stock restored automatically

---

## Checkout Flow (Logged-in)

1. User selects address from saved list
2. Backend validates
3. Fetch shipping cost (RajaOngkir based on destination city)
4. Calculate total: subtotal → apply tax → add shipping → grand total
5. Deduct stock from products
6. Create order (customer_id = user.id) with `expires_at`
7. Buyer selects payment method:

   **Xendit path:**
   8. Call Xendit API → create invoice
   9. Redirect user to Xendit payment page
   10. Xendit webhook → update order status to `paid`
   11. Send email notification (payment confirmed)

   **Manual Transfer path:**
   8. Show bank transfer instructions (bank list + amount)
   9. Buyer uploads transfer proof → status `waiting_confirmation`
   10. Notify seller via email (new confirmation to review)
   11. Seller approves → status `paid` + email notification to buyer

---

## Subtotal / Tax / Total Calculation

```
subtotal = Σ (item price × qty)                [in active currency]
tax_total = Σ (active tax rates applied)        [each tax: subtotal × rate%]
shipping_cost = RajaOngkir response
grand_total = subtotal + tax_total + shipping_cost
```

* All amounts stored as integers (smallest currency unit: cents/sen)
* Tax calculation order: subtotal → apply tax(es) → store tax_total
* Each tax rate is individually togglable
* Shipping calculated after tax (as specified per tax's `apply_to` field)

---

# 7. Performance Strategy

## Database

* Connection pool: 5–10 max
* Avoid long transactions

---

## Memory

* Avoid large in-memory objects
* Stream responses when possible

---

## Rendering

* Server-side only
* Minimal JS payload (<50KB gzipped)

---

## Logging

* Only:

  * info
  * error

---

## Health Check

* `GET /health` — returns `{ status: "ok", uptime: seconds }`
* Used by Docker healthcheck
* No DB query required (simple ping response)

---

# 8. Docker Design

## docker-compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    environment:
      - DATABASE_URL=postgres://app:app@db:5432/app
      - JWT_SECRET=change-me
      - STORAGE_TYPE=local
      - SETUP_SECRET=        # optional, lock /setup page
      # Optional S3:
      # - S3_ENDPOINT=
      # - S3_BUCKET=
      # - S3_ACCESS_KEY=
      # - S3_SECRET_KEY=
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 5s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  # uploads volume handled by bind mount above
```

---

## Dockerfile Strategy

### Multi-stage build

1. Builder stage

* install dependencies
* build NestJS app

2. Runtime stage

* copy build output only
* minimal Node image
* expose 3000

---

# 9. Database Schema (Draft)

## tables

```
users
  id            PK uuid
  email         unique
  password_hash
  name
  phone
  role          enum('customer','seller')
  created_at
  updated_at

password_reset_tokens
  id            PK uuid
  user_id       FK users
  token         unique varchar
  expires_at    timestamp
  created_at

sessions
  id            PK uuid
  user_id       FK users (nullable, for guest)
  data          JSON (cart data)
  expires_at
  created_at

customer_addresses
  id            PK uuid
  user_id       FK users
  label         varchar
  recipient_name
  phone
  address_line text
  city
  province
  postal_code
  is_default    boolean
  created_at

products
  id            PK uuid
  name
  slug          unique
  description   text
  price         integer (in default currency smallest unit)
  weight        integer (grams)
  stock         integer
  min_order     integer (default 1)
  meta_title    varchar (nullable)
  meta_description text (nullable)
  og_image      varchar (nullable)
  is_active     boolean (default true)
  created_at
  updated_at

product_images
  id            PK uuid
  product_id    FK products
  url           varchar
  is_primary    boolean
  sort_order    integer

product_variants
  id            PK uuid
  product_id    FK products
  name          varchar (e.g. "Red / XL")
  size          varchar (nullable)
  color         varchar (nullable)
  price         integer (override, nullable)
  weight        integer (nullable, inherit product weight if null)
  stock         integer
  created_at

orders
  id            PK uuid
  order_number  unique varchar (e.g. "INV/20260430/001")
  customer_id   FK users (nullable)
  status        enum
  payment_method enum('xendit','manual_transfer')
  subtotal      integer
  tax_total     integer (default 0)
  shipping_cost integer
  total         integer
  currency      varchar (e.g. "IDR")
  items         JSON
  shipping_address JSON
  courier       varchar
  courier_service varchar
  tracking_number varchar (nullable)
  payment_invoice_id varchar (nullable, Xendit)
  payment_url   varchar (nullable)
  expires_at    timestamp
  created_at
  updated_at

payment_confirmations
  id            PK uuid
  order_id      FK orders (unique)
  sender_bank   varchar
  sender_name   varchar
  amount        integer
  transfer_date date
  receipt_image varchar
  notes         text (nullable)
  status        enum('pending','approved','rejected')
  rejection_reason text (nullable)
  created_at
  reviewed_at   (nullable)

bank_accounts
  id            PK uuid
  bank_name     varchar
  account_number varchar
  account_holder varchar
  logo_url      varchar (nullable)
  is_active     boolean (default true)
  sort_order    integer
  created_at

tax_rates
  id            PK uuid
  name          varchar (e.g. "PPN")
  rate          decimal (percentage, e.g. 11.0)
  apply_to      enum('subtotal','subtotal_shipping')
  is_active     boolean (default true)
  created_at

currencies
  code          PK varchar (e.g. "IDR", "USD")
  name          varchar (e.g. "Indonesian Rupiah")
  symbol        varchar (e.g. "Rp", "$")
  exchange_rate decimal (relative to default currency, 1.0 for default)
  is_default    boolean
  is_active     boolean
  created_at

settings
  id            PK uuid
  key           unique varchar
  value         text
```

---

# 10. Constraints

## Must Follow

* Max 2 containers
* No Redis
* No background workers (webhook handling is synchronous at endpoint)
* No microservices
* No plugin system

---

## Target Performance

* RAM usage: < 800MB total
* Concurrent users: 10–30 stable

---

# 11. Non-Goals

* Multi-tenant system
* Enterprise scalability
* Real-time features
* Complex analytics
* Product categories (v1)
* Discount / coupon system (v1)
* Review / rating system (v1)

---

# 12. Development Rules for AI Agent

## DO

* Write minimal code
* Prefer simple logic over abstraction
* Measure memory impact
* Keep dependencies minimal

## DO NOT

* Introduce new services
* Add unnecessary libraries
* Implement unused features
* Optimize prematurely

---

## File Size Limits (Lines of Code)

To maintain readability and ease of maintenance, enforce the following LoC limits per file type:

| File Type | Max LoC | Strategy if exceeded |
|---|---|---|
| `.ts` controller | 150 lines | Split into multiple controllers or extract dummy data to separate file |
| `.ts` service/module | 200 lines | Split logic into helper functions or sub-modules |
| `.ejs` view template | 200 lines | Extract repeated sections into partials (`<%- include(...) %>`) |
| `.css` stylesheet | 3000 lines | Split into multiple CSS files (e.g. `base.css`, `components.css`, `admin.css`) |
| `.json` config/locale | 300 lines | Split into sub-files per domain |

### Rules

* **EJS views**: Extract sidebar, form sections, table components into `/views/**/partials/`
* **Controllers**: If a controller has many routes, split by domain (e.g. `admin-products.controller.ts`, `admin-orders.controller.ts`)
* **Dummy data**: During UI-first development, keep dummy data in separate `.ts` files (e.g. `src/data/dummy-products.ts`)
* **CSS**: If `app.css` exceeds 3000 lines, split into logical chunks imported via `<link>` tags
* Regularly audit file sizes — no single file should become a maintenance burden

---

# Final Principle

> Simplicity is not fewer features.
> Simplicity is fewer decisions at runtime.

This system must prioritize:

* predictability
* low resource usage
* fast execution

Over:

* flexibility
* extensibility
* architectural purity
