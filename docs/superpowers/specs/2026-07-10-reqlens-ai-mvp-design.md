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
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password) |
| AI | OpenAI via a provider abstraction (`/lib/ai`) with a keyless mock mode |
| Validation | zod |
| Testing | Vitest |
| CI | GitHub Actions — install, lint, typecheck, test, build (host-agnostic) |
| Deployment | **Hostinger** (VPS or Node.js hosting) |

### Deployment target: Hostinger (not Vercel)
The app requires a Node server (SSR + Server Actions + the AI route handler), so a static export is
not viable. Build with `output: 'standalone'` in `next.config`, then run `next start` (or the
standalone server) under **PM2** behind an **nginx** reverse proxy on a Hostinger VPS. No
Vercel-specific APIs or adapters are used. `.env` is provisioned on the server; `.env.example` is
committed and documents every variable. Deploy steps are documented in the README.

### Keyless-first build
Neither Supabase nor OpenAI credentials exist yet. The app is built to run and be tested without
live keys:
- **OpenAI:** the `/lib/ai` mock implementation activates automatically when `OPENAI_API_KEY` is
  absent, returning schema-conformant reviews so the full flow and CI tests work. Flipping to live
  requires only setting the key.
- **Supabase:** SQL migrations + RLS policies + seed data are committed so a fresh project can be
  provisioned by running the migrations. The app reads Supabase URL/keys from env.

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
  /db               tenant-scoped data-access layer — the ONLY module that talks to Supabase
  /auth             session retrieval, profile + tenant_id derivation
  /rbac             permission matrix + can(role, action) helper
  /ai               provider interface, openai impl, deterministic mock impl, prompt builder
  /scoring          score model, readiness status mapping, AI-JSON validation
  /kpi              KPI + AI Dependency Index + quality-trend calculations
  /validation       zod input schemas (story, project, domain, document)
/supabase           migrations (schema + RLS), seed
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
- **RLS policies** on every tenant-owned table restrict rows to the requesting user's tenant (the
  hard backstop of the hybrid isolation strategy).

---

## 5. Tenant Isolation (Decision C — Hybrid)

Defense in depth:
1. **Database RLS** — Postgres policies ensure a query can only ever see its own tenant's rows,
   even if application code has a bug.
2. **Application `/lib/db` layer** — the only place that touches Supabase; every function derives
   `tenant_id` from the authenticated user's profile and scopes queries by it. `tenant_id` is
   **never** accepted from the frontend.

A user in Tenant A can never read or write Tenant B's projects, stories, reviews, domains,
documents, or KPIs.

---

## 6. Auth & Tenant Onboarding

- Supabase Auth (email/password) for signup, login, logout.
- On **first signup**, a server action (or Postgres trigger) auto-creates a new `tenant` and inserts
  the user's `user_profile` with role `TENANT_ADMIN` and status `ACTIVE` (per Phase 3 simplification).
- Protected routes are gated by middleware plus server-side session verification. The session yields
  the profile, which yields `tenant_id` and `role` for all downstream authorization and scoping.

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

## 13. Build Order (9 phases, checkpoint at each boundary)

Follows the functional spec's implementation plan, adjusted for Hostinger and keyless-first:

1. Project setup (Next.js/TS/Tailwind/Supabase client/OpenAI SDK/Vitest, `.env.example`, layout/nav,
   `output: 'standalone'`).
2. Supabase data model (8 tables, `tenant_id`, RLS policies, `/lib/db` helpers).
3. Authentication (signup/login/logout, auto-tenant + TENANT_ADMIN on first signup).
4. Projects & domains (+ domain reference document paste/upload of `.txt`/`.md`).
5. Story creation (form, project + domain select, validation, draft save).
6. AI review (prompt builder, domain retrieval, OpenAI+mock, JSON validation, save, display).
7. Dashboard & KPIs (cards, My Stories table, charts, `/lib/kpi`).
8. Testing (the 4 suites above).
9. CI/CD & docs (GitHub Actions, README with **Hostinger** deploy steps, `.env.example`, secret
   audit).

---

## 14. Out of Scope (MVP)

Per `CLAUDE.md §4`: Jira/Azure DevOps integration, real payments, enterprise SSO, complex approval
workflows, PDF parsing pipeline, full vector DB RAG, multi-org membership, admin billing,
marketplace.
