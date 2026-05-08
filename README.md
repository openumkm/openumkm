# OpenUMKM — Lightweight eCommerce Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Self-hosted eCommerce engine built for small sellers. Optimized for 1 vCPU / 1GB RAM single-node deployment.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + Fastify |
| ORM | Drizzle ORM (SQL-first) |
| Database | PostgreSQL 15 |
| Frontend | EJS (server-side rendering) |
| Auth | JWT (httpOnly cookie) |
| Payment | Xendit + Manual Bank Transfer |
| Shipping | RajaOngkir (Komerce API v1) + Custom Methods |
| Email | Nodemailer (SMTP) |
| Storage | Local filesystem or S3-compatible |
| AI | OpenAI-compatible API |
| Styling | Custom CSS (Indigo design system, Inter font) |

## Features

- Product catalog with variants, images, SEO meta
- Guest & logged-in checkout with saved address support
- Xendit online payment + manual bank transfer with proof upload & review flow
- Shipping cost calculation via RajaOngkir (8 couriers) + configurable custom shipping methods
- Customer dashboard (order history, address management)
- Admin panel (products CRUD, orders, payment confirmations, full settings)
- Revenue dashboard (daily / weekly / monthly / yearly + breakdown by status)
- Multi-currency (IDR / USD) with manual exchange rates
- Configurable tax rates (multiple rates, togglable)
- AI content generation (product description, SEO meta) — client-side via OpenAI-compatible API
- Bilingual UI (Bahasa Indonesia / English) with cookie-persisted switcher
- Email notifications (order created, payment confirmed, shipped, cancelled, password reset)
- CSRF protection (Double Submit Cookie)
- First-run setup wizard with optional `SETUP_SECRET` lock

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use Docker)

### Development (without Docker)

```bash
# Install dependencies
npm install

# Generate migrations (if schema changed)
npm run db:generate

# Apply migrations
npm run db:migrate

# Build
npm run build

# Run
node dist/main.js
```

App runs at `http://localhost:3000`. First visit will redirect to `/setup`.

### Docker

```bash
docker compose up -d
```

This starts both the app (port 3000) and PostgreSQL with tuned low-memory settings (`shared_buffers=128MB`, `work_mem=4MB`, `max_connections=20`).

### Database Migration

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migration to database
npm run db:migrate
```

## Project Structure

```
src/
├── common/           # Shared helpers (auth cookie, CSRF, i18n, view helpers)
├── controllers/      # HTTP route handlers
│   ├── admin.controller.ts
│   ├── admin-orders.controller.ts
│   ├── admin-products.controller.ts
│   ├── admin-settings.controller.ts
│   ├── admin-settings-bank.controller.ts
│   ├── admin-settings-shipping.controller.ts
│   ├── admin-settings-tax.controller.ts
│   ├── auth.controller.ts
│   ├── cart.controller.ts
│   ├── checkout.controller.ts
│   ├── dashboard.controller.ts
│   ├── health.controller.ts
│   ├── payment.controller.ts
│   ├── setup.controller.ts
│   ├── storefront.controller.ts
│   └── xendit-webhook.controller.ts
├── services/         # Business logic
│   ├── address.service.ts
│   ├── auth.service.ts
│   ├── email.service.ts
│   ├── order.service.ts
│   ├── payment-confirmation.service.ts
│   ├── product.service.ts
│   ├── revenue.service.ts
│   ├── session.service.ts
│   ├── settings.service.ts
│   ├── setup.service.ts
│   ├── shipping.service.ts
│   ├── upload.service.ts
│   └── xendit.service.ts
├── db/
│   ├── index.ts      # Drizzle + pg pool
│   ├── schema.ts     # All table definitions
│   └── migrations/   # Generated SQL
├── mail/templates/   # EJS email templates (9 templates)
├── locales/
│   ├── id/           # Bahasa Indonesia translations
│   └── en/           # English translations
├── views/            # EJS templates
│   ├── admin/        # Admin panel pages + partials
│   ├── auth/         # Login, register, password reset
│   ├── dashboard/    # Customer dashboard
│   ├── partials/     # Shared: head, header, footer
│   ├── setup/        # First-run wizard
│   └── storefront/   # Home, product, cart, checkout
├── public/css/       # Stylesheets
├── app.module.ts
├── config.ts
└── main.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgres://app:app@localhost:5432/app` | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `opencode-secret` | Secret for JWT signing (change in production) |
| `PORT` | No | `3000` | Server port |
| `STORAGE_TYPE` | No | `local` | `local` or `s3` |
| `SETUP_SECRET` | No | _(empty)_ | Lock `/setup` page with a secret |
| `S3_ENDPOINT` | No | — | S3-compatible endpoint |
| `S3_BUCKET` | No | — | S3 bucket name |
| `S3_ACCESS_KEY` | No | — | S3 access key |
| `S3_SECRET_KEY` | No | — | S3 secret key |

Most runtime config (SMTP, Xendit, RajaOngkir, AI, store info) is configured at `/admin/settings` after setup.

## Database Schema

14 tables, 5 enums. See `src/db/schema.ts` for full definitions.

| Table | Purpose |
|---|---|
| `users` | Customer & seller accounts |
| `password_reset_tokens` | Password reset flow |
| `sessions` | Server-side sessions (cart data) |
| `customer_addresses` | Saved shipping addresses |
| `products` | Product catalog |
| `product_images` | Product image gallery |
| `product_variants` | Size/color variants with price override |
| `orders` | Order records with JSON items snapshot |
| `payment_confirmations` | Manual transfer proof uploads |
| `bank_accounts` | Seller bank accounts for manual transfer |
| `tax_rates` | Configurable tax rates |
| `currencies` | Multi-currency with exchange rates |
| `shipping_methods` | Custom shipping methods (flat rate, free shipping, etc) |
| `settings` | Key-value store for all config |

### Enums

- `user_role` — customer, seller
- `order_status` — pending, waiting_confirmation, paid, processing, shipped, completed, cancelled, expired
- `payment_method` — xendit, manual_transfer
- `confirmation_status` — pending, approved, rejected
- `tax_apply_to` — subtotal, subtotal_shipping

## Routes Overview

### Storefront
- `GET /` — Home / product listing (search, pagination, sort)
- `GET /product/:slug` — Product detail
- `GET /cart` / `POST /cart/add` / `POST /cart/update` / `POST /cart/remove`
- `GET /checkout` / `POST /checkout/submit`
- `GET /checkout/success/:id` — Order confirmation + payment instructions
- `GET /payment/confirm/:id` / `POST /payment/confirm/:id` — Manual transfer proof upload

### Auth
- `GET/POST /auth/login`
- `GET/POST /auth/register`
- `GET/POST /auth/forgot-password`
- `GET/POST /auth/reset-password/:token`
- `GET /auth/logout`

### Customer Dashboard
- `GET /dashboard` — Overview
- `GET /dashboard/orders` — Order history
- `GET /dashboard/orders/:id` — Order detail
- `GET /dashboard/addresses` — Address CRUD

### Admin
- `GET /admin` — Dashboard (revenue stats, recent orders)
- `GET /admin/revenue?period=` — Revenue breakdown JSON
- `GET /admin/products` + CRUD (with image & variant management)
- `GET /admin/orders` + status/tracking updates
- `GET /admin/payments/confirmations` + approve/reject
- `GET /admin/settings` (store info, API keys, SMTP, payment, couriers, currency, tax, SEO, AI)
- `GET /admin/settings/bank-accounts` + CRUD
- `GET /admin/settings/taxes` + CRUD
- `GET /admin/settings/currencies` + toggle/rate
- `GET /admin/settings/shipping-methods` + CRUD

### System
- `GET /health` — Health check
- `GET /setup` — First-run wizard
- `POST /xendit/webhook` — Xendit payment callback

## Production Checklist

Before deploying:

- [ ] Set `JWT_SECRET` to a strong random value
- [ ] Set `SETUP_SECRET` if you want to lock the `/setup` page
- [ ] After setup, configure at `/admin/settings`:
  - SMTP (required for password reset & order emails)
  - Xendit API key + **callback token** (required for webhook security)
  - RajaOngkir API key + origin city (if using RajaOngkir shipping)
  - AI endpoint (if using AI content generation)
- [ ] Configure bank accounts at `/admin/settings/bank-accounts` (if using manual transfer)
- [ ] Configure shipping mode at `/admin/settings` (`custom`, `rajaongkir`, or `both`)
- [ ] Add S3 env vars if using S3 storage instead of local uploads

> **Security note**: The Xendit webhook refuses all requests until `xendit_callback_token` is set in settings — this prevents unauthenticated order status tampering.

## Design Principles

> Simplicity is not fewer features. Simplicity is fewer decisions at runtime.

- Max 2 containers (app + db)
- No Redis, no background workers, no microservices
- Server-side rendering only, minimal client JS
- Target: <800MB RAM, 10–30 concurrent users

## Contributing

Contributions welcome! Lihat [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan lengkap.

## License

[MIT License](LICENSE) — free to use, modify, and distribute.
