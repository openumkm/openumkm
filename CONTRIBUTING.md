# Contributing to OpenUMKM

Thanks for your interest in contributing! 🙏

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use Docker)
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
# Edit .env as needed (at minimum DATABASE_URL)

# Start database (via Docker)
docker compose up db -d

# Apply migrations
npm run db:migrate

# Build & run
npm run build
node dist/main.js
```

Open `http://localhost:3000` — it will redirect to `/setup` for initial configuration.

## How to Contribute

### Reporting Bugs

1. Check [Issues](https://github.com/jipraks/openumkm-app/issues) — someone may have already reported it
2. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, browser)
   - Screenshots if relevant

### Suggesting Features

Create an issue with the `enhancement` label and describe:
- Use case / problem you want to solve
- Proposed solution
- Alternatives you've considered

### Pull Requests

1. Fork the repo
2. Create a branch from `main`: `git checkout -b feat/feature-name`
3. Make your changes
4. Ensure the build passes: `npm run build`
5. Commit using the format: `type(scope): description`
6. Push and create a Pull Request

### Commit Convention

Format: `type(scope): description`

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation changes
- `style` — formatting, no logic changes
- `refactor` — refactoring without behavior changes
- `perf` — performance improvement
- `chore` — maintenance (dependencies, config)

**Scopes:** `admin`, `storefront`, `auth`, `checkout`, `shipping`, `payment`, `db`, `email`, `ui`

**Examples:**
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
- Use Drizzle ORM query builder (not raw SQL)
- Server-side rendering with EJS — minimal client-side JS
- Follow existing patterns in the codebase
- File naming: `kebab-case` (e.g. `admin-orders.controller.ts`)

### File Size Guidelines

Keep each file focused on a single responsibility. Here are the line-of-code limits per file type:

| File type | Ideal | Max |
|---|---|---|
| Controller (`.controller.ts`) | <200 | 300 |
| Service (`.service.ts`) | <250 | 400 |
| Schema / types | <300 | 500 |
| View (`.ejs`) | <200 | 350 |
| Helper / utility | <100 | 150 |

**When a file exceeds the "Max" limit:**
- Controller → split by resource or action group
- Service → extract helper functions or sub-service
- View → extract into partials (`partials/` folder)
- Helper → split by concern

> Example: `admin-products.controller.ts` (293 lines) is near the limit because it handles CRUD + images + variants + AI config. If it grows further, consider splitting into `admin-product-images.controller.ts`.

## Design Principles

- **Simplicity first** — avoid over-engineering
- **Single-node friendly** — no Redis, no workers, no microservices
- **Low resource** — target <800MB RAM
- **Server-rendered** — minimal JavaScript in the browser

## Security

- Never commit secrets, API keys, or credentials
- Use parameterized queries (Drizzle handles this)
- Validate all user input
- If you find a security vulnerability, **do not create a public issue** — email the maintainer directly

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
