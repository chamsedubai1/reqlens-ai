# spec.md

# StoryScore AI — MVP Functional Specification

## 1. Product Name

StoryScore AI

## 2. Product Description

StoryScore AI is a multi-tenant AI-powered web application that reviews agile user stories and helps Business Analysts improve their story-writing quality.

The platform scores user stories, identifies weaknesses, proposes improved versions, generates acceptance criteria, suggests business rules and edge cases, and measures whether the user’s first-submission quality improves over time.

The platform also supports business domains and reference documents so the AI can review stories with domain-specific context.

---

## 3. Main Users

| User Type                        | Description                                   |
| -------------------------------- | --------------------------------------------- |
| Tenant Admin                     | Manages tenant, domains, documents, and users |
| Project Manager / Scrum Master   | Manages projects and monitors story quality   |
| Business Analyst / Product Owner | Creates stories and submits them for review   |
| Viewer                           | Views stories and reviews only                |

---

## 4. MVP Features

## 4.1 Authentication

Users must be able to sign up, log in, and access protected pages.

Each authenticated user must have a profile containing:

* Full name
* Email
* Tenant ID
* Role
* Status

---

## 4.2 Tenant Management

The MVP must support tenant-based isolation.

A tenant represents one organization or workspace.

Each tenant owns:

* Users
* Projects
* Business domains
* Domain documents
* User stories
* AI reviews
* Audit logs

---

## 4.3 Project Management

Authorized users can create projects.

Project fields:

* Project name
* Description
* Status
* Tenant ID
* Created by
* Created date

Only Tenant Admin and Project Manager can create projects.

---

## 4.4 Business Domain Management

Tenant Admin can create business domains.

Business domain fields:

* Domain name
* Description
* Status
* Tenant ID
* Created by
* Created date

Examples:

* Digital Banking
* Payments
* Anti-Money Laundering
* Restaurant POS
* Inventory Management
* Risk Management

---

## 4.5 Domain Reference Documents

Tenant Admin can add reference documents under a business domain.

For MVP, support either:

1. Paste reference text directly, or
2. Upload a `.txt` or `.md` file and store its text.

Document fields:

* Title
* Domain ID
* Tenant ID
* Content text
* File name
* File type
* Processing status
* Uploaded by
* Created date

The status can be:

* Uploaded
* Processed
* Failed
* Archived

Only processed documents should be used by the AI.

---

## 4.6 User Story Creation

Authorized users can create user stories.

Story fields:

* Project
* Business domain
* Story title
* User role
* Goal
* Business value
* Description
* Acceptance criteria
* Business rules
* Edge cases
* Status

Mandatory fields:

* Project
* Business domain
* Story title
* User role
* Goal
* Business value
* Description

---

## 4.7 AI Story Review

Users with permission can submit a story for AI review.

The AI must assess the story using:

* Agile quality criteria
* INVEST criteria
* Testability
* Acceptance criteria quality
* Business rule completeness
* Edge-case coverage
* Business domain context from uploaded reference documents

The AI must produce:

* Overall score
* Score breakdown
* Domain alignment score
* Readiness status
* Strengths
* Weaknesses
* Improved user story
* Improved acceptance criteria
* Suggested business rules
* Suggested edge cases
* Missing domain rules
* Domain-specific risks
* Referenced documents
* Recommendation

---

## 4.8 Story Review Storage

Every AI review must be saved.

Review fields:

* Tenant ID
* Project ID
* Story ID
* User ID
* First submission score
* Final score
* Improvement gap
* AI dependency level
* Readiness status
* Score breakdown
* Domain alignment score
* Strengths
* Weaknesses
* Improved story
* Suggested acceptance criteria
* Suggested business rules
* Suggested edge cases
* Missing domain rules
* Referenced documents
* Created date

---

## 4.9 Dashboard

The user dashboard must show:

### KPI Cards

* Total stories created
* Average first submission score
* Average final score
* AI Dependency Index
* Ready-on-first-submission rate
* Quality trend
* Most common weakness

### My Stories Table

Columns:

* Story title
* Project
* Business domain
* First submission score
* Latest score
* AI enhancement level
* Readiness status
* Created date
* Last reviewed date

---

## 4.10 Access Control

Permission rules:

| Action              | Tenant Admin | Project Manager | BA / PO | Viewer |
| ------------------- | -----------: | --------------: | ------: | -----: |
| Create project      |          Yes |             Yes |      No |     No |
| Create domain       |          Yes |              No |      No |     No |
| Add domain document |          Yes |              No |      No |     No |
| Create story        |          Yes |             Yes |     Yes |     No |
| Submit AI review    |          Yes |             Yes |     Yes |     No |
| View dashboard      |          Yes |             Yes |     Yes |    Yes |
| View story          |          Yes |             Yes |     Yes |    Yes |
| Delete story        |          Yes |             Yes |      No |     No |

---

## 5. Non-Functional Requirements

## 5.1 Security

* No hardcoded secrets.
* AI API key must stay server-side.
* User input must be validated.
* Tenant isolation must be enforced.
* Users must not access another tenant’s data.

## 5.2 Performance

* Dashboard should load quickly.
* AI review can take several seconds but should show loading state.
* Avoid duplicate AI calls.

## 5.3 Reliability

* Handle AI errors.
* Handle invalid AI JSON.
* Handle missing domain documents.
* Save reviews only after successful validation.

## 5.4 Usability

* UI should be simple and clean.
* Use clear cards, badges, and tables.
* Show score visually.
* Show readiness status clearly.

---

# IMPLEMENTATION_PLAN.md

# StoryScore AI — MVP Implementation Plan

## Phase 1 — Project Setup

Tasks:

1. Create Next.js app with TypeScript.
2. Add Tailwind CSS.
3. Install Supabase client.
4. Install OpenAI SDK.
5. Install Vitest.
6. Add `.env.example`.
7. Add base layout and navigation.

Expected commit:

```text
Initial Next.js project setup
```

---

## Phase 2 — Supabase Data Model

Tasks:

1. Create Supabase project.
2. Create tables:

   * tenants
   * user_profiles
   * projects
   * business_domains
   * domain_documents
   * user_stories
   * story_reviews
   * audit_logs
3. Add tenant_id to tenant-owned tables.
4. Add basic RLS policies if possible.
5. Add helper functions in `/lib/db`.

Expected commit:

```text
Add Supabase schema and tenant data model
```

---

## Phase 3 — Authentication

Tasks:

1. Add signup page.
2. Add login page.
3. Add logout.
4. Create user profile after signup.
5. Assign default tenant and role for MVP.

MVP simplification:

* On first signup, create a new tenant automatically using user email or organization name.
* Assign the first user as `TENANT_ADMIN`.

Expected commit:

```text
Add Supabase authentication and user profiles
```

---

## Phase 4 — Projects and Domains

Tasks:

1. Build projects page.
2. Allow Tenant Admin and Project Manager to create projects.
3. Build business domains page.
4. Allow Tenant Admin to create business domains.
5. Add domain detail page.
6. Allow Tenant Admin to paste or upload reference text.

Expected commit:

```text
Add project and business domain management
```

---

## Phase 5 — Story Creation

Tasks:

1. Build story creation form.
2. Allow users to select project and business domain.
3. Validate mandatory fields.
4. Save story as draft.
5. Redirect to story detail page.

Expected commit:

```text
Add user story creation flow
```

---

## Phase 6 — AI Review

Tasks:

1. Build prompt builder.
2. Retrieve domain documents.
3. Include domain context in prompt.
4. Call OpenAI API from server route.
5. Request JSON output.
6. Validate AI response.
7. Save review.
8. Display result.

Expected commit:

```text
Add AI story review with domain context
```

---

## Phase 7 — Dashboard and KPIs

Tasks:

1. Build dashboard page.
2. Show KPI cards.
3. Show My Stories table.
4. Implement KPI calculation service.
5. Calculate AI Dependency Index.
6. Calculate quality trend.

Expected commit:

```text
Add BA dashboard and KPI calculations
```

---

## Phase 8 — Testing

Tasks:

1. Add validation tests.
2. Add permission tests.
3. Add prompt builder tests.
4. Add KPI calculation tests.

Expected commit:

```text
Add unit tests for validation, permissions, prompt, and KPIs
```

---

## Phase 9 — CI/CD and Documentation

Tasks:

1. Add GitHub Actions workflow.
2. Add README.
3. Add deployment instructions.
4. Add demo script.
5. Verify no secrets are committed.
6. Deploy to Vercel.

Expected commit:

```text
Add CI workflow and project documentation
```

---

# DATA_MODEL.md

# StoryScore AI — Data Model

## 1. Entity Relationship Summary

```text
Tenant
  ├── User Profiles
  ├── Projects
  ├── Business Domains
  │     └── Domain Documents
  ├── User Stories
  │     └── Story Reviews
  └── Audit Logs
```

---

## 2. Tables

## tenants

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);
```

---

## user_profiles

```sql
create table user_profiles (
  id uuid primary key,
  tenant_id uuid references tenants(id) not null,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('TENANT_ADMIN', 'PROJECT_MANAGER', 'BA_PO', 'VIEWER')),
  status text not null default 'ACTIVE',
  created_at timestamp with time zone default now()
);
```

---

## projects

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  created_by uuid references user_profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

---

## business_domains

```sql
create table business_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  created_by uuid references user_profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

---

## domain_documents

```sql
create table domain_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  domain_id uuid references business_domains(id) not null,
  title text not null,
  file_name text,
  file_type text,
  file_size integer,
  content_text text,
  processing_status text not null default 'PROCESSED',
  document_summary text,
  uploaded_by uuid references user_profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

---

## user_stories

```sql
create table user_stories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  project_id uuid references projects(id) not null,
  domain_id uuid references business_domains(id) not null,
  title text not null,
  user_role text not null,
  goal text not null,
  business_value text not null,
  description text not null,
  acceptance_criteria text,
  business_rules text,
  edge_cases text,
  status text not null default 'DRAFT',
  created_by uuid references user_profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

---

## story_reviews

```sql
create table story_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  project_id uuid references projects(id) not null,
  domain_id uuid references business_domains(id) not null,
  story_id uuid references user_stories(id) not null,
  user_id uuid references user_profiles(id) not null,

  first_submission_score integer not null,
  final_score integer not null,
  improvement_gap integer not null,
  ai_dependency_level text not null,
  readiness_status text not null,

  role_clarity_score integer,
  business_value_score integer,
  functional_clarity_score integer,
  acceptance_criteria_score integer,
  invest_score integer,
  edge_case_score integer,
  testability_score integer,
  domain_alignment_score integer,

  strengths jsonb,
  weaknesses jsonb,
  missing_domain_rules jsonb,
  domain_specific_risks jsonb,
  improved_user_story text,
  improved_acceptance_criteria jsonb,
  suggested_business_rules jsonb,
  suggested_edge_cases jsonb,
  referenced_documents jsonb,
  recommendation text,

  created_at timestamp with time zone default now()
);
```

---

## audit_logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  user_id uuid references user_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamp with time zone default now()
);
```

---

## 3. Important Data Rule

Never accept `tenant_id` from the frontend.

Always derive `tenant_id` from the logged-in user profile.

---

# RAG_REQUIREMENTS.md

# StoryScore AI — Business Domain RAG Requirements

## 1. Purpose

The platform must allow Tenant Admins to define business domains and attach reference documents. These documents provide business context to the AI when reviewing user stories.

This allows the AI to provide domain-aware feedback instead of generic agile feedback only.

---

## 2. MVP RAG Scope

The MVP will implement RAG-lite.

RAG-lite means:

1. Admin creates a business domain.
2. Admin uploads or pastes reference text.
3. Reference text is stored in the database.
4. User selects business domain when creating a story.
5. During AI review, the system retrieves reference text for that domain.
6. AI uses that text as context.

---

## 3. Business Domain Examples

* Digital Banking
* Payments
* Core Banking
* Anti-Money Laundering
* Restaurant POS
* Inventory Management
* Customer Onboarding
* Loan Origination
* Risk Management

---

## 4. Domain Document Examples

* Business requirement documents
* Functional specifications
* Policies
* Process manuals
* Regulatory notes
* Product specifications
* Acceptance criteria templates
* Business rule catalogues
* System manuals
* Domain glossaries

---

## 5. AI Prompt Requirements

The AI prompt must include:

1. Agile story scoring criteria
2. User story details
3. Selected business domain name
4. Domain description
5. Relevant domain reference text
6. Instruction not to invent references
7. Instruction to clearly identify missing domain-specific rules

---

## 6. AI Output Requirements

The AI output must include:

* Domain alignment score
* Missing domain rules
* Domain-specific risks
* Suggested domain acceptance criteria
* Suggested domain business rules
* Referenced documents
* Recommendation

---

## 7. Business Rules

* A business domain belongs to one tenant.
* A document belongs to one tenant and one business domain.
* Only Tenant Admin can create domains.
* Only Tenant Admin can add documents.
* Users can only select domains from their own tenant.
* The AI must only use documents from the selected tenant and domain.
* If no domain document exists, the AI must say that the review is based only on general agile criteria.
* Documents from other tenants must never be used.

---

# TEST_PLAN.md

# StoryScore AI — MVP Test Plan

## 1. Required Unit Tests

The MVP must include at least three unit tests.

Recommended tests:

1. Story validation
2. Permission rules
3. Prompt builder
4. KPI calculation

---

## 2. Story Validation Tests

Test file:

```text
tests/storyValidation.test.ts
```

Scenarios:

* Empty title should fail.
* Empty user role should fail.
* Empty goal should fail.
* Empty business value should fail.
* Empty description should fail.
* Valid story should pass.

---

## 3. Permission Tests

Test file:

```text
tests/permissions.test.ts
```

Scenarios:

* Viewer cannot create story.
* BA / PO can create story.
* Project Manager can create project.
* Tenant Admin can create domain.
* BA / PO cannot create domain.

---

## 4. Prompt Builder Tests

Test file:

```text
tests/prompt.test.ts
```

Scenarios:

* Prompt includes story title.
* Prompt includes acceptance criteria.
* Prompt includes scoring model.
* Prompt includes domain context when available.
* Prompt includes instruction to return JSON.

---

## 5. KPI Calculation Tests

Test file:

```text
tests/kpiCalculation.test.ts
```

Scenarios:

* Average first score is calculated correctly.
* AI Dependency Index is calculated correctly.
* Ready-on-first-submission rate is calculated correctly.
* Quality trend returns Improving.
* Quality trend returns Stable.
* Quality trend returns Declining.

---

## 6. Manual Testing Checklist

Before submission, manually test:

* Signup works.
* Login works.
* Project creation works.
* Business domain creation works.
* Domain document text can be added.
* Story can be created.
* Story can be submitted for AI review.
* AI result is displayed.
* Story review is saved.
* Dashboard KPIs update.
* Viewer cannot create stories.
* No secrets are visible in GitHub.
* Live URL works in incognito.
