# ReqLens AI — Plan 5: CI/CD + Deployment Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the release scaffolding — a GitHub Actions CI pipeline, a complete README with Hostinger deployment steps, a demo seed script, a finalized `.env.example`, a secret audit, and reconciliation of the stale product name — so the MVP is deployable and documented.

**Architecture:** CI runs lint + typecheck + tests + build on Node 20 with no external services (tests use PGlite; the build renders dynamic routes without a DB). Deployment targets a Hostinger VPS: `next build` standalone output run under PM2 behind nginx, with self-hosted Postgres and migrations applied via the existing runner.

**Tech Stack:** GitHub Actions, Next.js standalone, PM2, nginx, PostgreSQL.

## Global Constraints

- Product name in all docs/copy: **ReqLens AI** (never "StoryScore AI").
- CI must run: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all green.
- No secrets committed; `.env.example` documents every variable with blank/placeholder values only.
- Deployment host is **Hostinger** (VPS), Postgres self-hosted; no Vercel-specific steps.
- Node 20+, npm.

---

### Task 1: GitHub Actions CI + green lint

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: any files needed to make `npm run lint` pass (ESLint has not been run before now).

- [ ] **Step 1: Run the CI commands locally and fix lint**

Run: `npm run lint`
If it reports errors, fix them (do not disable rules wholesale; fix the code or add targeted,
justified disables only where a rule is a false positive). Re-run until clean.
Then confirm: `npm run typecheck` (exit 0), `npm test` (all green), `npm run build` (succeeds).

- [ ] **Step 2: Create the workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          # Build renders only dynamic routes (cookies/searchParams), so no DB is
          # needed; a placeholder session secret satisfies any module-load checks.
          SESSION_SECRET: ci-placeholder-session-secret-value-32chars
```

- [ ] **Step 3: Verify the workflow commands pass locally**

Run each CI step locally in order and confirm all succeed:
`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git add -A   # include any lint fixes
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, test, build)"
```

---

### Task 2: README, Hostinger deploy docs, seed script, secret audit, name reconciliation

**Files:**
- Overwrite: `README.md` (currently a duplicate of the old spec)
- Create: `scripts/seed.mjs`
- Modify: `package.json` (add `db:seed` script)
- Modify: `CLAUDE.md` (replace "StoryScore AI" → "ReqLens AI")
- Confirm: `.env.example`

- [ ] **Step 1: Overwrite `README.md`**

Write a complete README with these sections (fill with the project's real details):
```markdown
# ReqLens AI

Domain-Aware Requirements Intelligence — an AI quality gate for agile user stories.
ReqLens AI scores user stories, proposes improvements, and tracks whether a Business
Analyst's first-submission quality improves over time.

## Features
- Email/password auth with multi-tenant isolation; first signup provisions a tenant + admin.
- Projects, business domains, and reference documents (paste or .txt/.md upload).
- Domain-aware AI story review with a 7-category quality score, readiness status, and improvements.
- Runs with a deterministic mock reviewer when no OpenAI key is set (set `OPENAI_API_KEY` for live).
- Personal KPI dashboard: avg first/final score, AI Dependency Index, ready-on-first rate, quality trend.
- Role-based permissions (TENANT_ADMIN, PROJECT_MANAGER, BA_PO, VIEWER) enforced server-side.

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
Brief map of `/app`, `/lib` (db, auth, ai, rbac, scoring, kpi, validation, review), `/db/migrations`, `/tests`.
```
Then append a **Hostinger Deployment** section documenting:
1. Provision an Ubuntu VPS; install Node 20, PostgreSQL 16, and PM2 (`npm i -g pm2`), and nginx.
2. Create the database and a DB user; set `DATABASE_URL` accordingly.
3. Clone the repo; `npm ci`; set env vars (`DATABASE_URL`, `SESSION_SECRET`, optional `OPENAI_API_KEY`)
   in the shell/PM2 ecosystem (never commit them).
4. `npm run build` (produces `.next/standalone`).
5. Copy static assets into the standalone output: `cp -r .next/static .next/standalone/.next/static`
   and `cp -r public .next/standalone/public`.
6. Apply migrations: `npm run db:migrate`.
7. Start: `pm2 start .next/standalone/server.js --name reqlens` (listens on `PORT`, default 3000).
8. Configure nginx as a reverse proxy from port 80/443 to `127.0.0.1:3000`; add TLS via Let's Encrypt.
9. `pm2 save` + `pm2 startup` so it survives reboots.

- [ ] **Step 2: Seed script**

`scripts/seed.mjs` — a small idempotent-ish demo seed. It must connect via `DATABASE_URL`, use the
compiled query layer is not available from plain node, so use raw SQL via `pg` to insert a demo
tenant + admin (password hash for "password123" precomputed with bcryptjs), a project, a domain, and
a document. Keep it minimal and print the login email/password at the end. Example structure:
```js
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const email = "demo@reqlens.test";
const passwordHash = await bcrypt.hash("password123", 10);
const tenantId = randomUUID();
const userId = randomUUID();

const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("insert into tenants (id, name) values ($1, $2)", [tenantId, "Demo Org"]);
  await client.query(
    "insert into user_profiles (id, tenant_id, full_name, email, password_hash, role) values ($1,$2,$3,$4,$5,$6)",
    [userId, tenantId, "Demo Admin", email, passwordHash, "TENANT_ADMIN"],
  );
  const projectId = randomUUID();
  await client.query("insert into projects (id, tenant_id, name, created_by) values ($1,$2,$3,$4)", [projectId, tenantId, "Mobile Banking App", userId]);
  const domainId = randomUUID();
  await client.query("insert into business_domains (id, tenant_id, name, description, created_by) values ($1,$2,$3,$4,$5)", [domainId, tenantId, "Payments", "Fund transfers and limits", userId]);
  await client.query(
    "insert into domain_documents (id, tenant_id, domain_id, title, content_text, processing_status, uploaded_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [randomUUID(), tenantId, domainId, "Transfer Policy", "Transfers above 50000 require OTP. Daily limit is 200000.", "PROCESSED", userId],
  );
  await client.query("commit");
  console.log(`Seeded. Login: ${email} / password123`);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await pool.end();
}
```
Add to `package.json` scripts: `"db:seed": "node --import tsx scripts/seed.mjs"` (or plain
`"db:seed": "node scripts/seed.mjs"` since it is plain JS — prefer plain node).

- [ ] **Step 3: Reconcile the product name in `CLAUDE.md`**

Replace every occurrence of "StoryScore AI" with "ReqLens AI" in `CLAUDE.md`. Do not change any other
content. (The functional behavior is identical; only the name was stale.)

- [ ] **Step 4: Secret audit**

Run a search for accidentally committed secrets and confirm none exist:
`git grep -nEi "sk-[a-z0-9]{20,}|api[_-]?key\s*=\s*['\"][^'\"]+|postgres://[^ '\"]*:[^ '\"]*@" -- . ':(exclude)*.md' ':(exclude).env.example'`
Expected: no real secret values (matches only in docs/examples with blank placeholders are fine).
Confirm `.gitignore` still ignores `.env` and `.env*.local`, and that no `.env` or `.env.local` is tracked (`git ls-files | grep -E "^\.env"` should show only `.env.example`).

- [ ] **Step 5: Confirm `.env.example`**

Confirm `.env.example` lists `DATABASE_URL`, `SESSION_SECRET` (with the ">= 32 chars" hint),
`OPENAI_API_KEY`, `OPENAI_MODEL`, all with blank/placeholder values.

- [ ] **Step 6: Verify + commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build` — all green (the seed script is
plain JS, not imported by the app, so it does not affect typecheck/build).
```bash
git add README.md scripts/seed.mjs package.json CLAUDE.md
git commit -m "docs: add README with Hostinger deploy steps, demo seed, and name fixes"
```

---

## Plan 5 Self-Review

**Spec coverage:** GitHub Actions workflow (§ Must Build) → Task 1; README complete (§ Must Build) →
Task 2; `.env.example` present + documented → Task 2; Hostinger deploy steps (host decision) → Task 2;
secret audit / no committed secrets (§ NFR security) → Task 2; demo seed for the manual test flow →
Task 2; product-name reconciliation → Task 2. ✓

**Placeholder scan:** the seed script's "password123" is an intentional documented demo credential,
not a real secret. No TBD/TODO. ✓

**Consistency:** CI runs exactly the four commands the Global Constraints require; README env table
matches `.env.example`; deploy steps match the `output: 'standalone'` config from Plan 1. ✓

**End state:** with Plan 5 merged, the MVP is feature-complete, tested, CI-gated, documented, and
deployable to Hostinger. Deferred/optional future work: real vector-search RAG, review history UI,
team dashboard, admin user management page, and the perf indexes noted in earlier reviews.
