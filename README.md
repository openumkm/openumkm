# OpenUMKM — Lightweight eCommerce Engine

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
| Shipping | RajaOngkir |
| Styling | Custom CSS (Indigo design system, Inter font) |

## Features

- Product catalog with variants, images, SEO meta
- Guest & logged-in checkout
- Xendit online payment + manual bank transfer with proof upload
- Shipping cost calculation via RajaOngkir (8 couriers)
- Customer dashboard (orders, addresses)
- Admin panel (products CRUD, orders, payment confirmations, settings)
- Multi-currency (IDR/USD) with manual exchange rates
- Configurable tax rates
- AI content generation (OpenAI-compatible)
- Bilingual UI (Bahasa Indonesia / English)
- First-run setup wizard

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use Docker)

### Development (without Docker)

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (requires PostgreSQL running)
node dist/main.js
```

App runs at `http://localhost:3000`.

### Docker

```bash
docker compose up -d
```

This starts both the app (port 3000) and PostgreSQL.

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
├── common/           # Shared helpers (auth cookie)
├── controllers/      # HTTP route handlers
│   ├── admin.controller.ts
│   ├── admin-products.controller.ts
│   ├── admin-orders.controller.ts
│   ├── admin-settings.controller.ts
│   ├── auth.controller.ts
│   ├── dashboard.controller.ts
│   ├── health.controller.ts
│   ├── setup.controller.ts
│   └── storefront.controller.ts
├── services/         # Business logic
│   ├── auth.service.ts
│   ├── order.service.ts
│   ├── product.service.ts
│   ├── settings.service.ts
│   └── setup.service.ts
├── db/
│   ├── index.ts      # Drizzle + pg pool
│   ├── schema.ts     # All table definitions
│   └── migrations/   # Generated SQL
├── data/             # Dummy data (UI-first dev)
├── views/            # EJS templates
│   ├── admin/        # Admin panel pages + partials
│   ├── auth/         # Login, register, password reset
│   ├── dashboard/    # Customer dashboard
│   ├── partials/     # Shared: head, header, footer
│   ├── setup/        # First-run wizard
│   └── storefront/   # Home, product, cart, checkout
├── public/css/       # Stylesheet
├── app.module.ts
├── config.ts
└── main.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgres://app:app@localhost:5432/app` | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `opencode-secret` | Secret for JWT signing |
| `PORT` | No | `3000` | Server port |
| `STORAGE_TYPE` | No | `local` | `local` or `s3` |
| `SETUP_SECRET` | No | _(empty)_ | Lock `/setup` page with a secret |
| `S3_ENDPOINT` | No | — | S3-compatible endpoint |
| `S3_BUCKET` | No | — | S3 bucket name |
| `S3_ACCESS_KEY` | No | — | S3 access key |
| `S3_SECRET_KEY` | No | — | S3 secret key |

## Database Schema

13 tables, 5 enums. See `src/db/schema.ts` for full definitions.

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
| `settings` | Key-value store for all config |

## Routes Overview

### Storefront
- `GET /` — Home / product listing
- `GET /product/:slug` — Product detail
- `GET /cart` — Shopping cart
- `GET /checkout` — Checkout form
- `GET /checkout/success/:id` — Order confirmation
- `GET /payment/confirm/:id` — Payment proof upload

### Auth
- `GET/POST /auth/login` — Login
- `GET/POST /auth/register` — Register
- `GET/POST /auth/forgot-password` — Password reset request
- `GET/POST /auth/reset-password/:token` — Set new password
- `GET /auth/logout` — Logout

### Customer Dashboard
- `GET /dashboard` — Overview
- `GET /dashboard/orders` — Order history
- `GET /dashboard/orders/:id` — Order detail
- `GET /dashboard/addresses` — Address management

### Admin
- `GET /admin` — Dashboard (revenue stats)
- `GET /admin/products` — Product list + CRUD
- `GET /admin/orders` — Order management
- `GET /admin/payments/confirmations` — Payment proof review
- `GET /admin/settings` — Store settings
- `GET /admin/settings/bank-accounts` — Bank account CRUD
- `GET /admin/settings/taxes` — Tax rate CRUD
- `GET /admin/settings/currencies` — Currency management

### System
- `GET /health` — Health check
- `GET /setup` — First-run wizard

## Development Status

### Done
- [x] Full EJS UI templates (storefront, auth, dashboard, admin)
- [x] CSS design system (Indigo primary, Inter font, responsive)
- [x] Database schema (Drizzle ORM, 13 tables)
- [x] Migration SQL generated
- [x] Services (auth, setup, settings, product, order)
- [x] Controllers wired to services with JWT auth guards
- [x] Docker setup (Dockerfile + docker-compose)

### To Do
- [ ] Wire storefront controllers to real services (currently dummy data)
- [ ] Run migration on PostgreSQL
- [ ] File upload (product images, payment receipts)
- [ ] Cart session management (DB-backed)
- [ ] Xendit payment integration
- [ ] RajaOngkir shipping integration
- [ ] Email notifications (SMTP)
- [ ] AI content generation endpoint
- [ ] i18n translation files
- [ ] Customer dashboard wired to real data

## Design Principles

> Simplicity is not fewer features. Simplicity is fewer decisions at runtime.

- Max 2 containers (app + db)
- No Redis, no background workers, no microservices
- Server-side rendering only, minimal client JS
- Target: <800MB RAM, 10-30 concurrent users

## License

Private project.
