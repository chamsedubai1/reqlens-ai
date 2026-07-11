# ReqLens AI

Domain-Aware Requirements Intelligence — an AI quality gate for agile user stories.
ReqLens AI scores user stories, proposes improvements, and tracks whether a Business
Analyst's first-submission quality improves over time.

## Features

- Email/password auth with multi-tenant isolation; first signup provisions a tenant + admin.
- Projects, business domains, and reference documents (paste or `.txt`/`.md` upload).
- Domain-aware AI story review with a 7-category quality score, readiness status, and improvements.
- Runs with a deterministic mock reviewer when no OpenAI key is set (set `OPENAI_API_KEY` for live).
- Personal KPI dashboard: avg first/final score, AI Dependency Index, ready-on-first rate, quality trend.
- Role-based permissions (`TENANT_ADMIN`, `PROJECT_MANAGER`, `BA_PO`, `VIEWER`) enforced server-side.

## Tech Stack

Next.js (App Router) · TypeScript · Tailwind CSS · self-hosted PostgreSQL · Drizzle ORM ·
custom auth (bcrypt + jose) · OpenAI (optional) · Vitest · GitHub Actions · Hostinger (VPS).

## Local Development

1. `npm install`
2. Copy `.env.example` to `.env.local` and set values (see Environment below).
3. Start a local Postgres (e.g. Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`).
4. Apply migrations: `npm run db:migrate`
5. (Optional) Seed demo data: `npm run db:seed`
6. `npm run dev` and open http://localhost:3000

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `SESSION_SECRET` | yes | >= 32 chars. `openssl rand -base64 48`. |
| `OPENAI_API_KEY` | no | When unset, the deterministic mock reviewer is used. |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. |

## Testing

`npm test` — Vitest unit + PGlite-backed integration tests (no external DB required).

## Scripts

`npm run dev|build|start|lint|typecheck|test|db:generate|db:migrate|db:seed`

## Deployment (Hostinger VPS)

See "Hostinger Deployment" below.

## Project Structure

```
app/
  (public)/        Landing, /login, /signup
  (app)/            Protected routes: /dashboard, /projects, /projects/[projectId],
                     /stories/new, /stories/[storyId], /domains, /domains/[domainId]
  actions/          Server actions (auth, features, review)
lib/
  db/               Drizzle client, schema, queries
  auth/             Session handling, password hashing, current-user/guard helpers
  ai/               OpenAI client, deterministic mock reviewer, prompt builder
  review/           Review persistence
  rbac.ts           Role-based permission checks
  scoring.ts        Story quality scoring model
  kpi.ts            BA improvement KPI calculations
  validation.ts     Input validation (Zod)
db/migrations/      SQL migrations (Drizzle Kit), applied by scripts/migrate.mjs
scripts/            migrate.mjs (db:migrate), seed.mjs (db:seed)
tests/              Vitest unit + PGlite integration tests
```

## Hostinger Deployment

These steps assume an Ubuntu VPS on Hostinger with root/sudo access.

1. **Provision the VPS.** Install Node 20, PostgreSQL 16, PM2, and nginx:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql postgresql-contrib nginx
   sudo npm install -g pm2
   ```
2. **Create the database and a DB user**, then set `DATABASE_URL` accordingly:
   ```bash
   sudo -u postgres psql -c "CREATE USER reqlens WITH PASSWORD 'change-me';"
   sudo -u postgres psql -c "CREATE DATABASE reqlens OWNER reqlens;"
   # DATABASE_URL=postgres://reqlens:change-me@localhost:5432/reqlens
   ```
3. **Clone the repo and install dependencies:**
   ```bash
   git clone <repo-url> reqlens-ai && cd reqlens-ai
   npm ci
   ```
   Set `DATABASE_URL`, `SESSION_SECRET`, and (optionally) `OPENAI_API_KEY` in the shell
   environment or a PM2 ecosystem file. Never commit these values.
4. **Build the app** (produces the standalone server in `.next/standalone`):
   ```bash
   npm run build
   ```
5. **Copy static assets into the standalone output** (the standalone build does not
   include `.next/static` or `public` by default):
   ```bash
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   ```
6. **Apply migrations:**
   ```bash
   npm run db:migrate
   ```
7. **Start the app with PM2** (listens on `PORT`, default `3000`):
   ```bash
   pm2 start .next/standalone/server.js --name reqlens
   ```
8. **Configure nginx** as a reverse proxy from port 80/443 to `127.0.0.1:3000`, and add
   TLS with Let's Encrypt (`certbot --nginx`).
9. **Persist across reboots:**
   ```bash
   pm2 save
   pm2 startup
   ```
