# Product Requirements Document — ReqLens AI

| | |
|---|---|
| **Product** | ReqLens AI |
| **Document owner** | Product Team |
| **Version** | 1.0 |
| **Date** | 2026-07-12 |
| **Status** | Live (MVP) — deployed at https://reqlensai.com |

> **Scope note:** This PRD describes the ReqLens AI MVP **as actually built and deployed**. Everything below reflects shipped behavior; items not yet built are called out explicitly in Component 6 (Out of Scope).

The six required PRD components map to the sections below:

1. **Overview & Problem Statement** — §1
2. **Goals & Success Metrics** — §2
3. **Target Users & Personas** — §3
4. **Features & Functional Requirements (with acceptance criteria)** — §4
5. **Non-Functional Requirements & Constraints** — §5
6. **Release Plan, Assumptions & Out of Scope** — §6

---

## 1. Overview & Problem Statement

### 1.1 Problem
Agile teams commit user stories to sprints that are vague, untestable, or missing acceptance criteria and domain rules. Poor stories are discovered *during* the sprint, causing rework, scope churn, and missed edge cases. Review today is manual, inconsistent between reviewers, and gives Business Analysts (BAs) no measurable feedback on whether their writing is improving.

### 1.2 Vision
ReqLens AI is an **AI-powered quality gate for agile user stories**. Before sprint planning, a BA submits a story and receives a structured quality score, concrete improvements, and domain-aware feedback grounded in the organization's own reference documents. Over time, the BA's personal dashboard shows whether their first-draft quality is improving.

### 1.3 Product summary
A multi-tenant web application where a user signs up into an organization (tenant), creates projects and business domains, uploads domain reference text, writes user stories, submits them for AI review, and tracks personal and team improvement KPIs.

### 1.4 Background / current state
The MVP is live and multi-tenant, with custom authentication, tenant-isolated data, role-based permissions, an AI reviewer backed by a self-hosted open model (Qwen via Ollama) with a deterministic fallback, and personal/team KPI dashboards. It is deployed on a VPS behind a reverse proxy with HTTPS.

---

## 2. Goals & Success Metrics

### 2.1 Goals
- **G1** — Give BAs an objective, repeatable quality score for every story before sprint planning.
- **G2** — Provide concrete, domain-aware improvements a BA can apply immediately.
- **G3** — Measurably raise first-submission story quality over time.
- **G4** — Keep every tenant's data strictly isolated and access role-appropriate.

### 2.2 Success metrics (tracked in-product on the KPI dashboard)
| Metric | Definition | Target direction |
|---|---|---|
| **Average first-submission score** | Mean of `first_submission_score` across a user's stories | ↑ over time |
| **Ready-on-first-submission rate** | Stories with `first_submission_score ≥ 80` ÷ total stories | ↑ toward 100% |
| **AI Dependency Index** | `Average final score − Average first-submission score` | **↓** over time (BA relies on AI less) |
| **Quality trend** | Latest 5 first-submission scores vs. previous 5: Δ ≥ +5 = *Improving*, −5…+5 = *Stable*, ≤ −5 = *Declining* | *Improving*/*Stable* |
| **Most common weakness** | Most frequent weakness category across a user's reviews | Shifts away from the same category |

### 2.3 Non-goals
Replacing human sprint planning, auto-approving stories without a person in the loop, or generating stories from scratch without a BA author.

---

## 3. Target Users & Personas

| Persona | Role in app | Primary needs |
|---|---|---|
| **Priya — Business Analyst / Product Owner** | `BA_PO` | Write stories, get scored feedback, apply improvements, track her own quality trend. Primary user. |
| **Marco — Project Manager** | `PROJECT_MANAGER` | Create projects, review any story, and see the **team** KPI dashboard. |
| **Aisha — Tenant Admin** | `TENANT_ADMIN` | Set up the organization: manage users/roles, create business domains, upload reference documents, and view audit logs. |
| **Sam — Stakeholder / Viewer** | `VIEWER` | Read-only visibility into projects and story reviews. |

### 3.1 Permission matrix (enforced server-side)
| Capability | Tenant Admin | Project Manager | BA / PO | Viewer |
|---|:---:|:---:|:---:|:---:|
| Manage tenant & users | ✅ | ❌ | ❌ | ❌ |
| Create project | ✅ | ✅ | ❌ | ❌ |
| View project / story review | ✅ | ✅ | ✅ | ✅ |
| Create business domain & upload documents | ✅ | ❌ | ❌ | ❌ |
| Create story & submit for AI review | ✅ | ✅ | ✅ | ❌ |
| View **personal** dashboard | ✅ | ✅ | ✅ | ✅ |
| View **team** dashboard | ✅ | ✅ | ❌ | ❌ |

---

## 4. Features & Functional Requirements

Each feature lists **testable acceptance criteria** in Given / When / Then form.

### F1 — Authentication & organization onboarding
A user signs up, which atomically creates their organization (tenant) and makes them its Tenant Admin; existing users log in.
- **AC1.1** — *Given* a new email and a valid password (≥ 8 chars), *when* the user signs up, *then* a new tenant is created, a `TENANT_ADMIN` profile is created, and the user is signed in and redirected to the dashboard.
- **AC1.2** — *Given* an email that is already registered, *when* the user signs up, *then* the request is rejected with "That email is already registered" and no tenant/profile is created.
- **AC1.3** — *Given* valid credentials, *when* the user logs in, *then* a signed, httpOnly session cookie is set and protected pages become accessible.
- **AC1.4** — *Given* a deactivated user with the correct password, *when* they attempt to log in, *then* login is refused.

### F2 — Projects
Authorized users create and view projects that scope stories.
- **AC2.1** — *Given* a Tenant Admin or Project Manager, *when* they submit a project name, *then* the project is created under their tenant and appears in the projects list.
- **AC2.2** — *Given* a BA/PO or Viewer, *when* they open the projects page, *then* they can view projects but the "create project" control is not available to them.
- **AC2.3** — *Given* a user in Tenant A, *when* they list projects, *then* only Tenant A projects are returned — never Tenant B's.

### F3 — Business domains & reference documents (RAG-lite)
Tenant Admins define business domains and attach reference text used to make reviews domain-aware.
- **AC3.1** — *Given* a Tenant Admin, *when* they create a business domain, *then* it is stored under the tenant and available for selection when writing a story.
- **AC3.2** — *Given* a Tenant Admin on a domain page, *when* they paste text or upload a `.txt`/`.md` file, *then* the document text is stored against that domain and marked processed.
- **AC3.3** — *Given* a non-`.txt`/`.md` file, *when* upload is attempted, *then* it is rejected with "Only .txt or .md files are supported."
- **AC3.4** — *Given* a story under a domain with reference documents, *when* it is reviewed, *then* the relevant document text is included in the AI prompt and referenced documents are listed in the result.

### F4 — User story authoring
Any author role captures a story with structured fields and optional details.
- **AC4.1** — *Given* the New Story page, *when* the user submits, *then* Project, Business Domain, Story Title, User Role, Goal, Business Value, and Description are **required**; Acceptance Criteria, Business Rules, and Edge Cases are optional.
- **AC4.2** — *Given* a required field is empty, *when* the user submits, *then* submission is blocked and the missing field is indicated.
- **AC4.3** — *Given* a saved story, *when* it is created, *then* it receives a human-readable per-tenant reference formatted as `<PROJECT-PREFIX>-<n>` (e.g., `MOB-42`).
- **AC4.4** — *Given* a story-template selection, *when* chosen, *then* the template pre-fills the story text fields.

### F5 — AI story review & scoring (core feature)
On submission, the story is scored on 7 weighted categories and returned as validated structured JSON with improvements.
- **AC5.1** — *Given* a submitted story, *when* the review runs, *then* the result includes an `overallScore` (0–100) and a `scoreBreakdown` across the 7 categories with these maximums: Role clarity 10, Business value 15, Functional clarity 15, Acceptance criteria 20, INVEST compliance 20, Edge cases 10, Testability 10 (**sum = 100**).
- **AC5.2** — *Given* an overall score, *when* readiness is derived, *then* it is: **Excellent** (90–100), **Ready** (80–89), **Needs Improvement** (65–79), **Not Ready** (0–64).
- **AC5.3** — *Given* the AI response, *when* it is received, *then* its structure is **validated before persistence**; an invalid structure is never saved.
- **AC5.4** — *Given* a review result, *when* displayed, *then* it shows strengths, weaknesses, missing domain rules, domain-specific risks, an improved user story, suggested acceptance criteria, suggested business rules, suggested edge cases, referenced documents, and a recommendation.
- **AC5.5** — *Given* a self-hosted model that is slow or unavailable, *when* the call exceeds the timeout or errors, *then* the app falls back to a deterministic reviewer so a valid review is **always** returned (no hard failure/timeout).

### F6 — Inline review & iterate-in-place
The New Story page shows the assessment without navigating away, so the author can refine and re-review.
- **AC6.1** — *Given* the New Story page, *when* "Review with AI" is clicked, *then* an "Analyzing…" state is shown and, on completion, the full assessment appears on the same page.
- **AC6.2** — *Given* an assessment is shown, *when* "Apply AI suggestions to form" is clicked, *then* the suggested acceptance criteria, business rules, and edge cases populate the form fields.
- **AC6.3** — *Given* an already-reviewed story on the page, *when* the user edits fields and clicks "Re-run AI review", *then* the **same** story is updated (not duplicated) and a new review is recorded.

### F7 — My Stories & story detail
Authors see their stories and each story's latest review plus history.
- **AC7.1** — *Given* a logged-in user, *when* they open the dashboard, *then* they see the stories they created with reference, score, and readiness status.
- **AC7.2** — *Given* a story with multiple reviews, *when* its detail page is opened, *then* the latest review is shown and a review history lists prior first/final scores and improvement gap, newest first.
- **AC7.3** — *Given* any data table (stories, drill-down, admin), *when* the user interacts with it, *then* columns can be sorted and rows filtered/searched.

### F8 — Personal & team KPI dashboards
BAs track their own improvement; managers/admins see the team view.
- **AC8.1** — *Given* a user with reviewed stories, *when* the dashboard loads, *then* it shows Total stories, Average first-submission score, Average final score, AI Dependency Index, Ready-on-first-submission rate, Quality trend, and Most common weakness.
- **AC8.2** — *Given* the AI Dependency Index, *when* computed, *then* it equals `Average final score − Average first-submission score`.
- **AC8.3** — *Given* the ready-on-first-submission rate, *when* computed, *then* it equals `count(first_submission_score ≥ 80) ÷ total stories`.
- **AC8.4** — *Given* a KPI card, *when* clicked, *then* a drill-down lists the underlying stories (sortable/filterable).
- **AC8.5** — *Given* a BA/PO or Viewer, *when* they attempt the team dashboard, *then* access is denied; a Project Manager or Tenant Admin sees team-wide KPIs.

### F9 — Tenant administration & audit
Tenant Admins manage the workspace and see an activity trail.
- **AC9.1** — *Given* a Tenant Admin, *when* they open Admin, *then* they can list team members with roles/status, add a member, change a role, activate/deactivate, and reset a password.
- **AC9.2** — *Given* the last active admin, *when* deactivation or the last-admin role change is attempted, *then* it is blocked (an organization always keeps one admin).
- **AC9.3** — *Given* key actions (project/domain/document/story created, story reviewed, user changes), *when* they occur, *then* a tenant-scoped audit log entry is recorded with the actor and is viewable by the admin.

---

## 5. Non-Functional Requirements & Constraints

### 5.1 Security & multi-tenancy
- **NFR1** — Every tenant-owned record carries a `tenant_id`; queries are scoped by the **authenticated** user's tenant. The app never trusts a `tenant_id` supplied by the client.
- **NFR2** — A user in Tenant A can never read Tenant B's projects, stories, reviews, domains, documents, or KPIs (verified by automated tenant-isolation tests).
- **NFR3** — Passwords are hashed (bcrypt); sessions use a signed JWT in an httpOnly, SameSite cookie, marked Secure in production. AI provider keys are server-side only and never exposed to the browser.
- **NFR4** — Role-based permissions are enforced on the server for every mutating action.

### 5.2 AI behavior & reliability
- **NFR5** — The reviewer targets any OpenAI-compatible endpoint (self-hosted Qwen via Ollama by default; also OpenAI or a hosted Qwen gateway). The call is time-bounded (`AI_TIMEOUT_MS`, default 90s) and falls back to a deterministic reviewer, so reviews always return within the proxy timeout.
- **NFR6** — Input is validated before any AI call; AI output is schema-validated before persistence.

### 5.3 Quality, performance & operations
- **NFR7** — Automated tests (Vitest) cover validation, scoring/KPI logic, permissions, and tenant isolation; CI (GitHub Actions) runs on every push.
- **NFR8** — The app runs as a Node server behind a reverse proxy over HTTPS; the story upload limit is 4 MB.
- **NFR9** — Written in TypeScript with business logic isolated in `/lib`; secrets are provided via environment and are never committed.

---

## 6. Release Plan, Assumptions & Out of Scope

### 6.1 Release status
MVP is **shipped and live** at https://reqlensai.com. All Component 4 features (F1–F9) are implemented and deployed.

### 6.2 Technology (as built)
Next.js (App Router) + TypeScript + Tailwind CSS; PostgreSQL via Drizzle ORM; custom auth (bcrypt + JWT); self-hosted Qwen via Ollama (OpenAI-compatible) with deterministic fallback; deployed on a VPS with PM2 behind a Traefik reverse proxy and Let's Encrypt HTTPS; GitHub Actions CI.

### 6.3 Assumptions
- Each user belongs to exactly one tenant.
- Domain reference material is available as pasted text or `.txt`/`.md` files.
- The self-hosted model runs on the same host; CPU inference latency is acceptable for MVP with the timeout + fallback in place.

### 6.4 Out of scope (deliberately not in the MVP)
Jira / Azure DevOps integration; real payment processing; enterprise SSO; complex approval workflows; PDF parsing pipelines; full vector-database RAG (current retrieval is "RAG-lite" — latest domain documents included in the prompt; a `TODO` marks where vector search would slot in); multi-organization membership per user; billing/marketplace.

### 6.5 Future considerations
Vector-search retrieval over document chunks; asynchronous (queued) reviews to remove request-time latency; exportable review reports; richer team analytics.

---

*This document describes ReqLens AI as implemented in this repository and deployed to production; it introduces no features that are not present in the codebase.*
