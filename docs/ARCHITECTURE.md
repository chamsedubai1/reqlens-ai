# Technical Specification & Architecture — ReqLens AI

| | |
|---|---|
| **Product** | ReqLens AI |
| **Version** | 1.0 |
| **Date** | 2026-07-12 |
| **Companion docs** | [`PRD.md`](PRD.md) (product requirements), [`../CLAUDE.md`](../CLAUDE.md) (build spec), [`../.cursorrules`](../.cursorrules) (AI-assistant rules) |

> This spec describes ReqLens AI **as implemented in this repository**. Table, column, enum, and route names below match the actual source; it introduces nothing that isn't in the codebase.

The five specification elements map to the sections below:

1. **System Architecture & Request Flow** — §1
2. **Data Model** — §2
3. **Interface Contracts (server actions & AI review schema)** — §3
4. **Security & Multi-Tenancy** — §4
5. **Testing, Quality & CI** — §5

---

## Element 1 — System Architecture & Request Flow

### 1.1 Stack (as built)
- **Frontend/Backend:** Next.js (App Router) with React Server Components and **Server Actions** — one deployable Node process; no separate API tier.
- **Language/UI:** TypeScript end-to-end; Tailwind CSS.
- **Database:** PostgreSQL accessed through **Drizzle ORM** (`node-postgres`); PGlite (in-memory Postgres) for tests.
- **Auth:** custom — `bcryptjs` password hashing + `jose` HS256 JWT in an httpOnly cookie.
- **AI:** any OpenAI-compatible chat-completions endpoint; default self-hosted **Qwen via Ollama**, with a deterministic in-process reviewer as fallback.
- **Runtime/Deploy:** built as a standalone server, run under **PM2**, fronted by a **Traefik** reverse proxy with Let's Encrypt HTTPS.

### 1.2 Layered structure
| Layer | Location | Responsibility |
|---|---|---|
| Pages / UI | `app/**`, `components/**` | Server Components render data; client components handle interaction. |
| Server Actions | `app/actions/**` | Mutations & the review pipeline; every action derives identity from the session. |
| Domain logic | `lib/**` | Auth, permissions, scoring, KPIs, AI review, validation — framework-independent and unit-tested. |
| Data access | `lib/db/**` | Drizzle schema and **tenant-scoped** queries. |

### 1.3 AI review pipeline (request flow)
`New Story form` → `reviewStoryInlineAction` (Server Action) → `reviewAndPersistStory` → `reviewStory` (`lib/ai`) → OpenAI-compatible endpoint (Qwen/Ollama) → JSON extracted & **schema-validated** → mapped to a `story_reviews` insert → returned to the page and rendered inline.

**Testable acceptance criteria**
- **AC-A1** — *Given* a story submitted for review, *when* the pipeline runs, *then* control passes UI → server action → `lib` review → DB insert, and no AI call is made from the browser.
- **AC-A2** — *Given* the configured model is slow (> `AI_TIMEOUT_MS`, default 90s) or errors, *when* `reviewStory` runs, *then* it returns the deterministic reviewer's result rather than throwing.
- **AC-A3** — *Given* the standalone build, *when* deployed, *then* it serves behind the reverse proxy over HTTPS on a single Node process.

---

## Element 2 — Data Model

Eight tables; **every tenant-owned table carries `tenant_id` referencing `tenants.id`.** All primary keys are `uuid` (default random); timestamps are `timestamptz`.

| Table | Key columns | Notes |
|---|---|---|
| `tenants` | `id`, `name` | The organization boundary. |
| `user_profiles` | `id`, `tenant_id`, `email` (unique), `password_hash`, `role`, `status` | `role` is the `user_role` enum; `status` defaults `ACTIVE`. |
| `projects` | `id`, `tenant_id`, `name`, `status`, `created_by` | Scopes stories. |
| `business_domains` | `id`, `tenant_id`, `name`, `description`, `status` | Groups reference documents. |
| `domain_documents` | `id`, `tenant_id`, `domain_id`, `title`, `content_text`, `processing_status` | RAG-lite source text. |
| `user_stories` | `id`, `reference` (int), `tenant_id`, `project_id`, `domain_id`, `title`, `user_role`, `goal`, `business_value`, `description`, `acceptance_criteria?`, `business_rules?`, `edge_cases?`, `status` | `status` ∈ `DRAFT`/`REVIEWED`; `reference` is the per-tenant sequential number. |
| `story_reviews` | `id`, `tenant_id`, `story_id`, `user_id`, `first_submission_score`, `final_score`, `improvement_gap`, `ai_dependency_level`, `readiness_status`, 7 category scores, `domain_alignment_score`, jsonb suggestion arrays, `recommendation` | One row per review; history is preserved. |
| `audit_logs` | `id`, `tenant_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata` | Tenant-scoped activity trail. |

**Enum:** `user_role` = `TENANT_ADMIN` \| `PROJECT_MANAGER` \| `BA_PO` \| `VIEWER`.
**Relationships:** `user_profiles`, `projects`, `business_domains` → `tenants`; `domain_documents` → `business_domains`; `user_stories` → `projects` + `business_domains`; `story_reviews` → `user_stories` + `user_profiles`. Schema is managed by versioned migrations under `db/migrations`.

**Testable acceptance criteria**
- **AC-D1** — *Given* any tenant-owned table, *when* inspected, *then* it has a non-null `tenant_id` foreign key to `tenants.id`.
- **AC-D2** — *Given* a new story in a tenant, *when* created, *then* its `reference` = current max reference for that tenant + 1 (per-tenant sequence).
- **AC-D3** — *Given* a re-review of the same story, *when* persisted, *then* a **new** `story_reviews` row is added and the prior rows remain (history), with `improvement_gap = final_score − first_submission_score`.

---

## Element 3 — Interface Contracts

### 3.1 Server Actions (selected)
| Action | Input | Effect / output |
|---|---|---|
| `registerUserAction` / `loginAction` | email, password | Creates tenant+admin or authenticates; sets session cookie. |
| `createProjectAction` / `createDomainAction` / `createDocumentAction` | name/text/file | Tenant-scoped create; guarded by role. |
| `reviewStoryInlineAction` | story fields, `intent`, optional `storyId` | Creates/updates the story, optionally runs the review, **returns** `InlineReviewState` (no redirect). |
| `submitStoryForReviewAction` | `storyId` | Re-runs the review for an existing story. |
| admin actions | userId, role/status/password | Manage team; enforce "keep one admin". |

Inputs are validated with **Zod** (`lib/validation.ts`) before any write or AI call.

### 3.2 AI review JSON contract
The reviewer must return this structure; it is validated with `aiReviewSchema` (`lib/scoring.ts`) before persistence:
```json
{
  "overallScore": 0,
  "qualityLevel": "",
  "readinessStatus": "",
  "scoreBreakdown": {
    "roleClarity": 0, "businessValue": 0, "functionalClarity": 0,
    "acceptanceCriteria": 0, "investCompliance": 0, "edgeCases": 0, "testability": 0
  },
  "domainAlignmentScore": 0,
  "strengths": [], "weaknesses": [], "missingDomainRules": [], "domainSpecificRisks": [],
  "improvedUserStory": "",
  "improvedAcceptanceCriteria": [], "suggestedBusinessRules": [], "suggestedEdgeCases": [],
  "referencedDocuments": [], "recommendation": ""
}
```
**Scoring weights (sum = 100):** roleClarity 10, businessValue 15, functionalClarity 15, acceptanceCriteria 20, investCompliance 20, edgeCases 10, testability 10.
**Readiness thresholds:** Excellent ≥ 90, Ready ≥ 80, Needs Improvement ≥ 65, else Not Ready.

**Testable acceptance criteria**
- **AC-I1** — *Given* an AI response missing a required field or with a category over its max, *when* validated, *then* `validateAIReview` throws and the row is not persisted (the pipeline then falls back).
- **AC-I2** — *Given* a valid review, *when* persisted, *then* each category score is within its documented maximum and `readiness_status` matches the threshold for `final_score`.
- **AC-I3** — *Given* `reviewStoryInlineAction` with `intent="review"`, *when* it completes, *then* it returns the review state to the caller and performs no server-side redirect.

---

## Element 4 — Security & Multi-Tenancy

- **Identity:** session is a `jose` HS256 JWT in an httpOnly, SameSite cookie (Secure in production); passwords hashed with bcrypt.
- **Tenant isolation:** every query in `lib/db` is filtered by the **authenticated** user's `tenant_id`, derived from the session — never from client input. Cross-tenant reads/writes are impossible through the app layer.
- **Authorization:** a role→capability matrix (`lib/auth`) is enforced server-side via `requireCan(...)` before every mutating action; the UI additionally hides unauthorized controls.
- **Secrets:** AI keys and DB credentials come from environment variables and are server-only; `.env*` is never committed.

**Testable acceptance criteria**
- **AC-S1** — *Given* a user in Tenant A, *when* they request Tenant B's project/story/review/domain/document/KPI, *then* nothing is returned (covered by tenant-isolation tests).
- **AC-S2** — *Given* a BA/PO, *when* they invoke a create-project or team-dashboard action, *then* the server rejects it on the permission check.
- **AC-S3** — *Given* a request without a valid session cookie, *when* it hits a protected route/action, *then* it is redirected/denied.

---

## Element 5 — Testing, Quality & CI

- **Framework:** Vitest, run against PGlite so DB logic is tested for real without external services.
- **Coverage areas:** input validation, scoring & KPI math, permission rules, tenant isolation, auth service, queries, audit logging, and review history.
- **CI:** GitHub Actions runs typecheck, lint, and the full test suite on every push.
- **Conventions:** TypeScript (`any` avoided); business logic in `/lib`; AI calls server-only; graceful AI error handling; small components. Enforced by `CLAUDE.md` and `.cursorrules`.

**Testable acceptance criteria**
- **AC-T1** — *Given* the repository, *when* `npm test` runs, *then* the full suite passes (currently 120 tests) with no external network or DB dependency.
- **AC-T2** — *Given* a push to the repo, *when* CI runs, *then* typecheck + lint + tests all pass before merge.
- **AC-T3** — *Given* the KPI formulas (AI Dependency Index, ready-on-first-submission rate, quality trend), *when* unit-tested with fixed inputs, *then* outputs match the definitions in `PRD.md` §2.
