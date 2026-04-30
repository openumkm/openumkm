# TASKS — OpenUMKM eCommerce Engine

Analisis gap antara `BASE_REQUIREMENT.md` dan implementasi saat ini.

**Legenda Status:**
- ✅ Done — sudah diimplementasi dan terhubung ke DB
- 🟡 Partial — ada kode tapi belum lengkap / masih pakai dummy data
- ❌ Not Started — belum ada implementasi sama sekali

---

## 1. Core Infrastructure

| # | Task | Status | Detail |
|---|------|--------|--------|
| 1.1 | Database schema (Drizzle) | ✅ | 13 tabel, 5 enum — sesuai spec |
| 1.2 | Migration SQL | ✅ | `0000_careful_morbius.sql` sudah di-generate |
| 1.3 | DB connection pool | ✅ | `src/db/index.ts`, max 10 connections |
| 1.4 | NestJS + Fastify setup | ✅ | `main.ts` dengan fastify-view, fastify-static, fastify-cookie |
| 1.5 | Docker (Dockerfile + compose) | ✅ | Multi-stage build, healthcheck, pgdata volume |
| 1.6 | Health endpoint | ✅ | `GET /health` → `{ status, uptime }` |
| 1.7 | EJS template engine | ✅ | Registered di `main.ts` |
| 1.8 | Static file serving | ✅ | `/static/` prefix |
| 1.9 | CSS design system | ✅ | `app.css` dengan Indigo theme |
| 1.10 | Fastify form body parser | ✅ | `@fastify/formbody` registered di `main.ts` |

---

## 2. Authentication & Setup

| # | Task | Status | Detail |
|---|------|--------|--------|
| 2.1 | Setup wizard (`/setup`) | ✅ | GET + POST, create admin + default settings + currencies |
| 2.2 | Login / Register | ✅ | `auth.controller.ts` + `auth.service.ts`, JWT cookie |
| 2.3 | Forgot password (create token) | ✅ | Token dibuat di DB, UUID, 1 jam expiry |
| 2.4 | Forgot password (send email) | ✅ | `EmailService.sendPasswordReset()` sends reset link via SMTP |
| 2.5 | Reset password | ✅ | Validate token + update password + delete token |
| 2.6 | Logout | ✅ | Clear cookie + redirect |
| 2.7 | Setup guard (redirect ke `/setup` jika belum setup) | ✅ | Fastify onRequest hook di `main.ts` |
| 2.8 | `SETUP_SECRET` protection | ✅ | Query param `?secret=` di `setup.controller.ts` |

---

## 3. Storefront (Customer-Facing)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 3.1 | Home / product listing | ✅ | Wired ke `ProductService.list()` dari DB |
| 3.2 | Product detail page | ✅ | Wired ke `ProductService.getBySlug()` dari DB |
| 3.3 | Search (`?q=`) | ✅ | DB query via `ProductService.list({ search })` |
| 3.4 | Pagination (`?page=&limit=`) | ✅ | Pagination di storefront home |
| 3.5 | Sort (`?sort=price_asc\|price_desc`) | ✅ | Sort support di `ProductService.list()` |
| 3.6 | Language switch (`?lang=`) | ✅ | Header ID/EN links + cookie persist, i18n detection di onRequest |
| 3.7 | SEO meta di `<head>` | ✅ | metaDescription dari DB settings + product description |
| 3.8 | Out of stock label + disabled checkout | ✅ | Badge "Out of Stock" di home + cart warning + checkout disabled |
| 3.9 | Currency display / switch | ✅ | Currency dropdown di header, cookie persist, detection di onRequest |

---

## 4. Cart (Session-Based)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 4.1 | Session management (DB-backed) | ✅ | `SessionService` dengan DB sessions |
| 4.2 | `POST /cart/add` | ✅ | Route di `StorefrontController` |
| 4.3 | `GET /cart` | ✅ | Wired ke `SessionService.getCart()` dari DB |
| 4.4 | `POST /cart/update` | ✅ | Route di `StorefrontController` |
| 4.5 | `POST /cart/remove` | ✅ | Route di `StorefrontController` |
| 4.6 | Guest cart (14 hari expiry) | ✅ | `GUEST_EXPIRY_DAYS = 14` di `SessionService` |
| 4.7 | Guest → login cart merge | ✅ | `SessionService.mergeGuestCart()` |
| 4.8 | Stock validation saat add to cart | ✅ | Stock check di `POST /cart/add` |
| 4.9 | Stock change warning di cart page | ✅ | `stockChanged` flag di cart items |

---

## 5. Checkout

| # | Task | Status | Detail |
|---|------|--------|--------|
| 5.1 | `GET /checkout` | ✅ | Wired ke real cart + tax rates + bank accounts dari DB |
| 5.2 | `POST /checkout/submit` | ✅ | Route di `StorefrontController` — create order + deduct stock |
| 5.3 | Guest checkout form (name, phone, address) | ✅ | Backend handler di `POST /checkout/submit` |
| 5.4 | Logged-in checkout (select saved address) | ✅ | Saved address selection di checkout, auto-fill form, submit pakai saved address |
| 5.5 | Shipping cost calculation (RajaOngkir) | ✅ | AJAX calculate via `ShippingService` |
| 5.6 | Tax calculation at checkout | ✅ | Query `tax_rates` table, calculate per active tax |
| 5.7 | Stock deduction on order create | ✅ | `ProductService.deductStock()` di checkout submit |
| 5.8 | Payment method selection (Xendit / Manual) | ✅ | Backend handles `paymentMethod` field |
| 5.9 | `GET /checkout/success/:id` | ✅ | Wired ke real order + bank accounts dari DB |

---

## 6. Payment

| # | Task | Status | Detail |
|---|------|--------|--------|
| 6.1 | Xendit invoice creation | ❌ | Tidak ada Xendit API integration |
| 6.2 | Xendit webhook handler | ❌ | Tidak ada webhook endpoint |
| 6.3 | Manual transfer — show bank accounts | ✅ | Bank accounts dari DB ditampilkan di checkout + payment confirm |
| 6.4 | `GET /payment/confirm/:id` | ✅ | Wired ke real order + bank accounts dari DB |
| 6.5 | `POST /payment/confirm/:id` (upload proof) | ✅ | Multipart upload + create payment confirmation |
| 6.6 | File upload untuk receipt image | ✅ | Multipart parsing + save to `/uploads/receipts/` |
| 6.7 | Admin: approve/reject payment | ✅ | `OrderService.approvePayment()` + `rejectPayment()` |
| 6.8 | Admin: payment confirmations list | ✅ | `GET /admin/payments/confirmations` |

---

## 7. Order Management

| # | Task | Status | Detail |
|---|------|--------|--------|
| 7.1 | Order CRUD (create, list, detail) | ✅ | `OrderService` dengan DB queries |
| 7.2 | Order number generation | ✅ | `{prefix}/{YYYYMMDD}/{seq}` format |
| 7.3 | Order status update | ✅ | `POST /admin/orders/:id/status` |
| 7.4 | Tracking number | ✅ | `POST /admin/orders/:id/tracking` |
| 7.5 | Order expiry check | ✅ | `checkExpiry()` — toggle ke `expired` on view |
| 7.6 | Stock restore on cancel/expire | ✅ | `restoreStock()` di `updateStatus()` |
| 7.7 | Admin order list (filter, search, pagination) | ✅ | Wired ke `OrderService.list()` |
| 7.8 | Admin order detail | ✅ | Wired ke `OrderService.getById()` |

---

## 8. Customer Dashboard

| # | Task | Status | Detail |
|---|------|--------|--------|
| 8.1 | `GET /dashboard` | ✅ | Wired ke `OrderService.listByCustomer()` |
| 8.2 | `GET /dashboard/orders` | ✅ | Wired ke real data + pagination |
| 8.3 | `GET /dashboard/orders/:id` | ✅ | Wired ke `OrderService.getById()` + expiry check |
| 8.4 | `GET /dashboard/addresses` | ✅ | Wired ke `AddressService.listByUser()` |
| 8.5 | `POST /dashboard/addresses` (add) | ✅ | Route di `DashboardController` |
| 8.6 | `POST /dashboard/addresses/:id` (edit) | ✅ | Route di `DashboardController` |
| 8.7 | `POST /dashboard/addresses/:id/delete` | ✅ | Route di `DashboardController` |
| 8.8 | Auth guard di dashboard | ✅ | `guard()` method checks JWT cookie |

---

## 9. Admin Dashboard & Revenue

| # | Task | Status | Detail |
|---|------|--------|--------|
| 9.1 | Dashboard stats (revenue) | ✅ | Wired ke `OrderService.getRevenueStats()` |
| 9.2 | Revenue periods (daily/weekly/monthly) | ✅ | Query DB dengan date filter |
| 9.3 | `GET /admin/revenue?period=` | ✅ | Route added di `AdminController`, returns JSON revenue stats + breakdown |
| 9.4 | Yearly revenue stats | ✅ | Yearly ditambahkan ke dashboard view |
| 9.5 | Breakdown by status (count) | ✅ | `getRevenueBreakdown()` di OrderService, ditampilkan di dashboard |
| 9.6 | Average order value display | ✅ | Dihitung di service, di-pass ke view + JSON endpoint |

---

## 10. Admin Products

| # | Task | Status | Detail |
|---|------|--------|--------|
| 10.1 | Product list (search, pagination) | ✅ | Wired ke `ProductService.list()` |
| 10.2 | Create product | ✅ | `POST /admin/products` |
| 10.3 | Edit product | ✅ | `GET /:id/edit` + `POST /:id` |
| 10.4 | Delete product | ✅ | `POST /:id/delete` |
| 10.5 | Product image upload | ✅ | Multipart upload di `admin-products.controller.ts` |
| 10.6 | Product image management (CRUD, primary, sort) | ✅ | Add + delete image routes |
| 10.7 | Product variant management | ✅ | Add + delete variant routes |
| 10.8 | OG image upload | ✅ | Field upload di product form + handled di create/edit |

---

## 11. Admin Settings

| # | Task | Status | Detail |
|---|------|--------|--------|
| 11.1 | Settings page (store info, API keys, SMTP, etc.) | ✅ | GET + POST, semua key disimpan ke DB |
| 11.2 | Bank accounts CRUD | ✅ | Add, toggle, delete |
| 11.3 | Bank account edit | ✅ | `POST /admin/settings/bank-accounts/:id` — inline edit di view |
| 11.4 | Bank account logo upload | ✅ | Multipart upload di add/edit form, saved to /uploads/bank-logos/ |
| 11.5 | Tax rates CRUD | ✅ | Add, toggle, delete |
| 11.6 | Tax rate edit | ✅ | `POST /admin/settings/taxes/:id` — inline edit di view |
| 11.7 | Currencies (toggle, exchange rate) | ✅ | Toggle active + update rate |
| 11.8 | Courier toggle | ✅ | Stored as comma-separated in settings |
| 11.9 | Store logo upload | ✅ | Multipart upload di settings form, saved ke setting `store_logo` |
| 11.10 | Origin city dropdown (RajaOngkir) | ✅ | Autocomplete via `/api/shipping/search` di settings form |

---

## 12. File Upload System

| # | Task | Status | Detail |
|---|------|--------|--------|
| 12.1 | `@fastify/multipart` registration | ✅ | Registered di `main.ts` |
| 12.2 | Local storage handler (save to `./uploads`) | ✅ | `UploadService` + inline upload di controllers |
| 12.3 | S3 storage handler | ❌ | Config ada tapi tidak ada S3 client |
| 12.4 | Static serving untuk uploads | ✅ | `/uploads/` prefix di `main.ts` |
| 12.5 | Max file size validation (5MB) | ✅ | Limit di multipart config + buffer check |
| 12.6 | Image serving (local static / S3 presigned URL) | 🟡 | Local serving ✅, S3 belum |

---

## 13. Shipping

### 13A. RajaOngkir Integration (Opsional — jika seller enable)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 13.1 | RajaOngkir API client | ✅ | `ShippingService` — native fetch, Komerce API v1 |
| 13.2 | Calculate shipping cost | ✅ | `POST /api/shipping/calculate` — AJAX dari checkout |
| 13.3 | City list / dropdown | ✅ | `GET /api/shipping/search?q=` — autocomplete di checkout |
| 13.4 | Courier filtering (enabled only) | ✅ | Reads `enabled_couriers` dari settings, map ke RajaOngkir codes |
| 13.5 | Toggle RajaOngkir on/off di settings | ✅ | Setting `rajaongkir_enabled` + `shipping_mode` ditambahkan, checkout cek toggle |

### 13B. Custom Shipping Methods (Alternatif — jika RajaOngkir tidak dipakai)

Seller bisa buat sendiri metode pengiriman dengan harga gratis atau statis. Contoh: "Gratis Ongkir", "Flat Rate Rp 10.000", "Kurir Toko Rp 5.000", dll. Bisa tambah berapapun metode.

| # | Task | Status | Detail |
|---|------|--------|--------|
| 13.6 | DB: tabel `shipping_methods` | ❌ | Tabel baru: `id`, `name`, `cost` (integer, 0 = gratis), `description`, `is_active`, `sort_order`, `created_at` |
| 13.7 | Admin: CRUD custom shipping methods | ❌ | `GET /admin/settings/shipping-methods` — list, add, edit, toggle, delete |
| 13.8 | Admin: settings toggle RajaOngkir vs Custom | ❌ | Setting `shipping_mode`: `rajaongkir` \| `custom` \| `both`. Default: `custom` |
| 13.9 | Checkout: tampilkan custom shipping methods | ❌ | Jika mode `custom` atau `both`, tampilkan list metode custom di checkout |
| 13.10 | Checkout: logic gabungan RajaOngkir + Custom | ❌ | Jika mode `both`, tampilkan RajaOngkir results + custom methods bersama |

### Shipping Mode Logic

```
shipping_mode = 'custom'      → Hanya tampilkan custom shipping methods
shipping_mode = 'rajaongkir'  → Hanya tampilkan RajaOngkir (butuh API key + origin city)
shipping_mode = 'both'        → Tampilkan keduanya, customer pilih salah satu
```

Jika `shipping_mode = 'custom'` dan tidak ada custom methods → shipping cost = 0 (gratis).
Jika `shipping_mode = 'rajaongkir'` dan API key belum diisi → fallback ke custom methods.

---

## 14. Payment Integration (Xendit)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 14.1 | Xendit API client | ❌ | Tidak ada HTTP client / service |
| 14.2 | Create invoice | ❌ | Tidak ada implementasi |
| 14.3 | Webhook endpoint (`POST /xendit/webhook`) | ❌ | Tidak ada route |
| 14.4 | Webhook signature verification | ❌ | Tidak ada implementasi |
| 14.5 | Payment URL redirect | ❌ | Field ada di schema tapi tidak diisi |

---

## 15. Email Notification (SMTP)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 15.1 | Email service (nodemailer) | ✅ | `EmailService` dengan nodemailer, reads SMTP config dari settings |
| 15.2 | EJS email templates | ✅ | 8 templates di `src/mail/templates/` dengan shared layout |
| 15.3 | Order created email (Xendit) | ✅ | `sendOrderCreatedXendit()` — triggered di checkout submit |
| 15.4 | Order created email (Manual transfer) | ✅ | `sendOrderCreatedManual()` — includes bank account list |
| 15.5 | Payment proof uploaded → seller email | ✅ | `sendPaymentProofUploaded()` — triggered di payment confirm |
| 15.6 | Payment confirmed email | ✅ | `sendPaymentConfirmed()` — ke customer + seller |
| 15.7 | Payment rejected email | ✅ | `sendPaymentRejected()` — includes rejection reason |
| 15.8 | Order shipped email | ✅ | `sendOrderShipped()` — includes tracking number |
| 15.9 | Order cancelled email | ✅ | `sendOrderCancelled()` — triggered di admin status change |
| 15.10 | Forgot password email | ✅ | `sendPasswordReset()` — sends reset link URL |

---

## 16. AI Content Generation

| # | Task | Status | Detail |
|---|------|--------|--------|
| 16.1 | AI service (OpenAI-compatible API) | ✅ | `AiService` — native fetch, chat completions endpoint |
| 16.2 | `POST /admin/ai/generate` endpoint | ✅ | AJAX JSON endpoint, supports 4 types |
| 16.3 | "Generate with AI" button di product form | ✅ | 3 buttons: description, meta title, meta description |
| 16.4 | AI generate untuk SEO fields | ✅ | `generateMetaTitle()` + `generateMetaDescription()` |

---

## 17. Localization (i18n)

| # | Task | Status | Detail |
|---|------|--------|--------|
| 17.1 | Translation JSON files (`/locales/id/`, `/locales/en/`) | ✅ | 4 namespaces × 2 bahasa: storefront, admin, dashboard, auth |
| 17.2 | Translation helper/middleware | ✅ | `i18n.ts` — `createTranslator()`, `detectLanguage()`, preload cache |
| 17.3 | Language switcher UI | ✅ | Sudah ada di header (ID \| EN), sekarang set cookie + persist |
| 17.4 | EJS templates pakai translation keys | ✅ | `t()` function injected ke semua views via Fastify hook |

---

## 18. Miscellaneous / Polish

| # | Task | Status | Detail |
|---|------|--------|--------|
| 18.1 | Dockerfile: hapus Prisma copy line | ✅ | Removed |
| 18.2 | PostgreSQL tuning di docker-compose | ✅ | `shared_buffers`, `work_mem`, `max_connections`, `effective_cache_size` |
| 18.3 | `@fastify/formbody` untuk parse POST body | ✅ | Registered di `main.ts` |
| 18.4 | Uploads volume serving | ✅ | Static route `/uploads/` di `main.ts` |
| 18.5 | Error handling / 404 page | ✅ | 404 view + global error handler di `main.ts` |
| 18.6 | CSRF protection | ❌ | Tidak ada CSRF token di forms |

---

## Prioritas Implementasi (Recommended Order)

### Phase 1 — Fix Critical Gaps (tanpa ini app tidak bisa jalan)
1. **18.3** Register `@fastify/formbody` (semua POST form butuh ini)
2. **2.7** Setup guard middleware (redirect ke `/setup`)
3. **4.1** Session service (DB-backed sessions)
4. **12.1–12.4** File upload system (multipart + local storage + static serving)

### Phase 2 — Wire Storefront ke Real Data
5. **3.1–3.5** Storefront: product listing dari DB (search, pagination, sort)
6. **3.2** Product detail dari DB
7. **4.2–4.5** Cart CRUD routes (add, update, remove)
8. **8.1–8.4** Dashboard wired ke real data
9. **8.5–8.7** Address CRUD routes
10. **8.8** Dashboard auth guard

### Phase 3 — Checkout & Payment Flow
11. **5.2** `POST /checkout/submit` — create order
12. **5.7** Stock deduction on order create
13. **6.5** `POST /payment/confirm/:id` — upload proof
14. **5.4** Logged-in checkout (saved addresses)
15. **5.6** Tax calculation dari `tax_rates` table

### Phase 4 — External Integrations
16. **13.1–13.4** RajaOngkir shipping integration
17. **14.1–14.5** Xendit payment integration
18. **15.1–15.10** Email notification service + templates

### Phase 5 — Advanced Features
19. **16.1–16.4** AI content generation
20. **17.1–17.4** i18n / localization
21. **10.5–10.7** Product images & variants management
22. **3.8–3.9** Stock label, currency display

### Phase 6 — Polish
23. **18.1** Fix Dockerfile (remove Prisma line)
24. **18.2** PostgreSQL tuning
25. **18.5** Error handling / 404
26. **2.8** SETUP_SECRET protection
27. **9.3–9.5** Revenue endpoint + yearly + status breakdown
28. **11.3, 11.6** Bank account & tax rate edit routes

---

## Summary

| Category | Done | Partial | Not Started | Total |
|----------|------|---------|-------------|-------|
| Infrastructure | 10 | 0 | 0 | 10 |
| Auth & Setup | 6 | 0 | 0 | 6 |
| Storefront | 9 | 0 | 0 | 9 |
| Cart | 9 | 0 | 0 | 9 |
| Checkout | 8 | 0 | 1 | 9 |
| Payment | 5 | 0 | 3 | 8 |
| Order Management | 8 | 0 | 0 | 8 |
| Customer Dashboard | 8 | 0 | 0 | 8 |
| Admin Dashboard | 5 | 0 | 1 | 6 |
| Admin Products | 8 | 0 | 0 | 8 |
| Admin Settings | 10 | 0 | 0 | 10 |
| File Upload | 4 | 1 | 1 | 6 |
| Shipping (RajaOngkir) | 5 | 0 | 0 | 5 |
| Shipping (Custom Methods) | 0 | 0 | 5 | 5 |
| Payment (Xendit) | 0 | 0 | 5 | 5 |
| Email (SMTP) | 10 | 0 | 0 | 10 |
| AI Generation | 4 | 0 | 0 | 4 |
| i18n | 4 | 0 | 0 | 4 |
| Misc / Polish | 5 | 0 | 1 | 6 |
| **TOTAL** | **116** | **1** | **19** | **136** |

**Progress: ~85% done, ~1% partial, ~14% belum dimulai.**

Yang sudah solid: DB schema, auth flow, admin orders, admin settings, admin products CRUD, setup wizard, **storefront wired ke DB, cart session, checkout flow, dashboard wired ke DB, file upload, address CRUD, email notifications (SMTP), RajaOngkir shipping, AI content generation, i18n**.
Yang belum: Xendit payment, custom shipping methods, CSRF protection, S3 storage, origin city dropdown.
