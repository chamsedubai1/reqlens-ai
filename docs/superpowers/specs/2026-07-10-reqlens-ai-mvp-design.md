# ReqLens AI — MVP Design

**Date:** 2026-07-10
**Status:** Approved (design phase) — pending user review of this document
**Source specs:** `CLAUDE.md`, `spec.md` / `README.md` (functional spec, data model, implementation plan, RAG requirements, test plan)

---

## 1. Summary

ReqLens AI ("Domain-Aware Requirements Intelligence") is a multi-tenant, AI-powered web app that
scores agile user stories, proposes improvements, and tracks whether a Business Analyst's
first-submission quality improves over time. It reviews stories with domain-specific context drawn
from reference documents (RAG-lite).

This document layers concrete architectural decisions on top of the existing functional spec. Where
the functional spec is authoritative (features, data model, permission matrix, scoring weights, KPI
formulas), it is referenced rather than restated.

### Naming reconciliation
The product name is **ReqLens AI** (per the logo, folder, and all UI mockups). The `CLAUDE.md`
still refers to "StoryScore AI" in places; those stale references will be updated to "ReqLens AI"
during implementation. Product logic is unchanged.

---

## 2. Stack & Deployment

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript (avoid `any`) |
| Styling | Tailwind CSS |
| Database | **Self-hosted PostgreSQL** on the Hostinger VPS (no Supabase) |
| DB access | Type-safe SQL layer in `/lib/db` (driver/ORM decided in Plan 2 — leaning Drizzle + `pg`) |
| Migrations | Plain SQL migration files run by a lightweight runner (decided in Plan 2) |
| Auth | **Custom** email/password: hashed passwords (bcrypt/argon2) + signed session cookie (jose/JWT), all server-side |
| AI | OpenAI via a provider abstraction (`/lib/ai`) with a keyless mock mode |
| Validation | zod |
| Testing | Vitest |
| CI | GitHub Actions — install, lint, typecheck, test, build (host-agnostic) |
| Deployment | **Hostinger** VPS — Next.js standalone + PM2 + nginx, Postgres on the same host |

### Deployment target: Hostinger (not Vercel)
The app requires a Node server (SSR + Server Actions + the AI route handler), so a static export is
not viable. Build with `output: 'standalone'` in `next.config`, then run `next start` (or the
standalone server) under **PM2** behind an **nginx** reverse proxy on a Hostinger VPS. No
Vercel-specific APIs or adapters are used. `.env` is provisioned on the server; `.env.example` is
committed and documents every variable. Deploy steps are documented in the README.

### Keyless-first build
No OpenAI key or provisioned database exists yet. The app is built to run and be tested without
live services:
- **OpenAI:** the `/lib/ai` mock implementation activates automatically when `OPENAI_API_KEY` is
  absent, returning schema-conformant reviews so the full flow and CI tests work. Flipping to live
  requires only setting the key.
- **PostgreSQL:** SQL migration files + seed data are committed so any Postgres instance (local
  Docker for dev, Hostinger VPS for prod) is provisioned by running the migrations. The app reads a
  `DATABASE_URL` connection string from env. The pure-logic modules (`/lib/rbac`, `/lib/scoring`,
  `/lib/kpi`, `/lib/validation`) require no database and are fully unit-tested in CI (Plan 1).

---

## 3. Architecture & Module Layout

```
/app
  (public)          landing (/), /login, /signup
  (app)             /dashboard, /projects, /projects/[id], /stories/new,
                    /stories/[id], /domains, /domains/[id], /admin
  /api/reviews      the single AI route handler (long-running; loading state)
/components         small presentational components + client islands (score ring, charts)
/lib
  /db               tenant-scoped data-access layer — the ONLY module that talks to Postgres
  /auth             password hashing, session cookie issue/verify, profile + tenant_id derivation
  /rbac             permission matrix + can(role, action) helper
  /ai               provider interface, openai impl, deterministic mock impl, prompt builder
  /scoring          score model, readiness status mapping, AI-JSON validation
  /kpi              KPI + AI Dependency Index + quality-trend calculations
  /validation       zod input schemas (story, project, domain, document)
/db                 SQL migration files + seed (run against the Postgres instance)
/tests              vitest suites
```

**Design principles:** each `/lib` module has one clear purpose and a well-defined interface; UI
components stay small; all business logic lives in `/lib`; AI calls and secrets stay server-side.

---

## 4. Data Model

Uses the eight tables from the functional spec's DATA_MODEL verbatim:

`tenants`, `user_profiles`, `projects`, `business_domains`, `domain_documents`, `user_stories`,
`story_reviews`, `audit_logs`.

- Every tenant-owned table carries `tenant_id`.
- `story_reviews` keeps the **7 per-category score columns** (role_clarity, business_value,
  functional_clarity, acceptance_criteria, invest, edge_case, testability) plus domain_alignment —
  matching the canonical scoring model (§7).
- Tenant isolation is enforced primarily at the application layer (§5), with optional Postgres RLS
  as a backstop.

---

## 5. Tenant Isolation (app-layer primary + optional Postgres RLS)

With self-hosted Postgres and custom auth, there is no Supabase JWT to drive RLS automatically, so
the **application `/lib/db` layer** is the primary guarantee:
1. **Application `/lib/db` layer (primary)** — the only module that touches Postgres. Every function
   derives `tenant_id` from the authenticated session's profile and scopes every query by it.
   `tenant_id` is **never** accepted from the frontend. This is covered by data-access tests.
2. **Optional Postgres RLS backstop** — policies keyed off a per-request `SET LOCAL app.tenant_id`
   set at the start of each request's transaction. Adds defense in depth without a Supabase JWT.
   Included if it stays simple in Plan 2; otherwise the app-layer scoping stands alone for the MVP.

A user in Tenant A can never read or write Tenant B's projects, stories, reviews, domains,
documents, or KPIs.

---

## 6. Auth & Tenant Onboarding

- **Custom email/password auth** (no Supabase). Passwords hashed with bcrypt/argon2; on login the
  server issues a signed, httpOnly session cookie (jose/JWT) carrying the user id. Signup, login, and
  logout are server actions / route handlers.
- On **first signup**, a single server-side database transaction creates the `tenant`, inserts the
  `user_profile` with role `TENANT_ADMIN` and status `ACTIVE`, stores the password hash, and issues
  the session — all atomically, so the profile always exists before the first authenticated request.
- Protected routes are gated by middleware plus server-side session verification. Verifying the
  cookie yields the user id → profile → `tenant_id` and `role` for all downstream authorization and
  scoping.

---

## 7. Story Scoring Model (Canonical = 7 categories)

The **7-category** weighted model from `CLAUDE.md §9` is canonical (it matches both the required AI
output JSON and the `story_reviews` columns):

| Category | Weight |
| --- | ---: |
| User role clarity | 10 |
| Business value clarity | 15 |
| Functional clarity | 15 |
| Acceptance criteria quality | 20 |
| INVEST compliance | 20 |
| Edge cases & alternative paths | 10 |
| Testability | 10 |

Readiness status: 90–100 Excellent · 80–89 Ready · 65–79 Needs Improvement · 0–64 Not Ready.

The User Story Workspace UI **may** group these into the mockup's 4 summary bars
(Clarity / Completeness / Consistency / Testability) for display only; the stored and computed data
remain 7-category.

---

## 8. AI Review Pipeline (Decisions: mock-mode abstraction + one route handler)

1. Validate story input (zod) server-side.
2. `/lib/db` fetches the latest **processed** `domain_documents` for the selected domain (tenant-scoped).
3. `/lib/ai` prompt builder assembles: scoring model + INVEST/testability criteria + full story
   fields + domain name/description + relevant document snippets + instructions ("do not invent
   references"; "explicitly list missing domain-specific rules"; "if no documents, state the review
   is general-agile-only"; "return JSON only").
4. Provider call — **OpenAI** impl in live mode, **deterministic mock** impl when no key.
5. `/lib/scoring` validates the returned JSON against the required schema (`CLAUDE.md §10`) and maps
   the overall score to readiness status. **A review that fails validation is never saved.**
6. Persist to `story_reviews` (first-submission score set on first review; final score updated on
   re-reviews; improvement_gap and AI dependency derived).
7. Render the workspace review summary.

RAG-lite; `// TODO: vector search` markers left where embeddings/vector retrieval would slot in.

---

## 9. Dashboard & KPIs

Per the mockup: KPI cards, First-Submission Score trend, Score Distribution donut, Most Common
Weakness, Insights, and the My Stories table. Calculations live in `/lib/kpi`:

- Total stories, Avg first-submission score, Avg final score.
- **AI Dependency Index** = Avg final − Avg first (goal: decreases over time).
- **Ready-on-first-submission rate** = stories with first_submission_score ≥ 80 / total.
- **Quality trend** = latest-5 vs previous-5 first-submission avg (≥+5 Improving, −5..+5 Stable,
  ≤−5 Declining).
- Most common weakness = most frequent weakness category across the user's reviews.

Team dashboard data is visible only to `TENANT_ADMIN` and `PROJECT_MANAGER`.

---

## 10. Permissions (RBAC)

The four roles (`TENANT_ADMIN`, `PROJECT_MANAGER`, `BA_PO`, `VIEWER`) and the exact permission
matrix from `CLAUDE.md §6` / spec §4.10, implemented as a single `can(role, action)` helper in
`/lib/rbac`, enforced **server-side** on every mutation and review submission (UI hiding is cosmetic
only, never the enforcement point).

---

## 11. Error Handling & Reliability

- AI API errors → surfaced as a friendly failure state; nothing persisted.
- Invalid/malformed AI JSON → validation fails, review not saved, user can retry.
- Missing domain documents → review proceeds as general-agile-only, stated explicitly.
- Unauthorized access → blocked server-side (403 / redirect).
- AI call shows a loading state; duplicate submissions guarded (disabled control + server guard).

---

## 12. Testing (Vitest, ≥4 suites)

1. **Story validation** — mandatory-field rules pass/fail cases.
2. **Permission rules** — role × action matrix (viewer cannot create story, BA can, PM can create
   project, admin can create domain, BA cannot, etc.).
3. **Prompt builder** — includes story fields, scoring model, domain context when present, JSON
   instruction.
4. **KPI calculations** — avg first score, AI Dependency Index, ready-on-first rate, quality-trend
   Improving/Stable/Declining.

Mock AI mode keeps the review flow runnable in CI without a key.

---

## 13. Build Order (delivered as a series of plans, each producing working, testable software)

Adjusted for Hostinger, self-hosted Postgres, and keyless-first. Each plan gets its own
plan → execute → review cycle.

- **Plan 1 — Scaffold + pure business logic (TDD):** Next.js/TS/Tailwind/Vitest boots
  (`output: 'standalone'`); `/lib` pure modules `validation`, `rbac`, `scoring`, `kpi`. CI green,
  no external services. *(complete)*
- **Plan 2 — Postgres data model + tenant-scoped `/lib/db` + custom auth:** SQL migrations for the 8
  tables (+ optional RLS), a migration runner, `DATABASE_URL` config, `/lib/db`, `/lib/auth`
  (hashing + session cookies), signup/login/logout, middleware, auto-tenant + TENANT_ADMIN on first
  signup.
- **Plan 3 — Projects, domains, documents, story creation:** feature pages + server actions, domain
  reference document paste/upload of `.txt`/`.md`.
- **Plan 4 — AI review + workspace UI + dashboard/KPIs:** `/lib/ai` (OpenAI + mock), prompt builder,
  domain retrieval, JSON validation, save/display; dashboard cards, charts, My Stories table.
- **Plan 5 — CI/CD + docs:** GitHub Actions, README with **Hostinger** (VPS + Postgres + PM2 +
  nginx) deploy steps, `.env.example`, secret audit.

---

## 14. Out of Scope (MVP)

Per `CLAUDE.md §4`: Jira/Azure DevOps integration, real payments, enterprise SSO, complex approval
workflows, PDF parsing pipeline, full vector DB RAG, multi-org membership, admin billing,
marketplace.
