# Contributing to OpenUMKM

Terima kasih sudah tertarik berkontribusi! 🙏

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (atau pakai Docker)
- Git

### Setup Development

```bash
# Clone repo
git clone https://github.com/jipraks/openumkm-app.git
cd openumkm-app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env sesuai kebutuhan (minimal DATABASE_URL)

# Jalankan database (via Docker)
docker compose up db -d

# Apply migrations
npm run db:migrate

# Build & run
npm run build
node dist/main.js
```

Buka `http://localhost:3000` — akan redirect ke `/setup` untuk konfigurasi awal.

## How to Contribute

### Reporting Bugs

1. Cek [Issues](https://github.com/jipraks/openumkm-app/issues) — mungkin sudah ada yang report
2. Buat issue baru dengan informasi:
   - Langkah reproduksi
   - Expected vs actual behavior
   - Environment (OS, Node version, browser)
   - Screenshot jika relevan

### Suggesting Features

Buat issue dengan label `enhancement` dan jelaskan:
- Use case / masalah yang ingin diselesaikan
- Solusi yang diusulkan
- Alternatif yang sudah dipertimbangkan

### Pull Requests

1. Fork repo
2. Buat branch dari `main`: `git checkout -b feat/nama-fitur`
3. Lakukan perubahan
4. Pastikan build berhasil: `npm run build`
5. Commit dengan format: `type(scope): description`
6. Push dan buat Pull Request

### Commit Convention

Format: `type(scope): description`

**Types:**
- `feat` — fitur baru
- `fix` — bug fix
- `docs` — perubahan dokumentasi
- `style` — formatting, tanpa perubahan logic
- `refactor` — refactoring tanpa perubahan behavior
- `perf` — performance improvement
- `chore` — maintenance (dependencies, config)

**Scopes:** `admin`, `storefront`, `auth`, `checkout`, `shipping`, `payment`, `db`, `email`, `ui`

**Contoh:**
```
feat(admin): add bulk product import
fix(checkout): calculate tax correctly for multiple items
docs: update README with new env variables
```

## Project Structure

```
src/
├── common/        # Shared helpers
├── controllers/   # HTTP route handlers
├── services/      # Business logic
├── db/            # Schema & migrations
├── views/         # EJS templates
├── locales/       # i18n (id/en)
├── mail/          # Email templates
└── public/        # Static assets (CSS)
```

## Code Style

- TypeScript strict mode
- Gunakan Drizzle ORM query builder (bukan raw SQL)
- Server-side rendering dengan EJS — minimal client-side JS
- Ikuti pattern yang sudah ada di codebase
- Nama file: `kebab-case` (contoh: `admin-orders.controller.ts`)

## Design Principles

- **Simplicity first** — hindari over-engineering
- **Single-node friendly** — no Redis, no workers, no microservices
- **Low resource** — target <800MB RAM
- **Server-rendered** — minimal JavaScript di browser

## Security

- Jangan commit secrets, API keys, atau credentials
- Gunakan parameterized queries (Drizzle handles this)
- Validasi semua user input
- Jika menemukan security vulnerability, **jangan buat public issue** — kirim email langsung ke maintainer

## License

Dengan berkontribusi, kamu setuju bahwa kontribusimu akan dilisensikan di bawah [MIT License](LICENSE).
