# CLAUDE.md

# StoryScore AI — Claude Code Build Instructions

## 1. Product Summary

Build **StoryScore AI**, a multi-tenant AI-powered web application that helps Business Analysts and Product Owners review, score, and improve agile user stories before sprint planning.

The application must allow users to:

1. Sign up and log in.
2. Belong to a tenant / organization.
3. Create projects.
4. Define business domains.
5. Upload or paste domain reference documents.
6. Create user stories.
7. Submit stories for AI review.
8. Receive a structured quality score.
9. Receive AI-generated improvements.
10. View all stories they created.
11. View personal improvement KPIs over time.

This is a course MVP. Do not overbuild enterprise features. Focus on a working deployed app with clean structure, basic security, tests, and documentation.

---

## 2. MVP Goal

The goal is to build a functional MVP that proves the following concept:

> StoryScore AI acts as an AI-powered quality gate for agile user stories. It scores stories, proposes improvements, and helps Business Analysts improve their first-submission quality over time.

The MVP must be deployable to Vercel and use a public GitHub repository.

---

## 3. Recommended Stack

Use the following stack unless there is a strong reason not to:

* Framework: Next.js App Router
* Language: TypeScript
* Styling: Tailwind CSS
* Database: Supabase PostgreSQL
* Authentication: Supabase Auth
* AI Provider: OpenAI API
* Deployment: Vercel
* CI/CD: GitHub Actions
* Testing: Vitest

---

## 4. Important Scope Control

Build the MVP only.

### Must Build

* Authentication
* Tenant-aware data model
* Role-based permissions
* Project creation
* Business domain creation
* Domain document upload or paste text
* User story creation
* AI story review
* AI scoring
* Domain-aware AI review using uploaded reference text
* My Stories dashboard
* Personal BA improvement KPI dashboard
* Basic tests
* GitHub Actions workflow
* README

### Do Not Build in MVP

* Jira integration
* Azure DevOps integration
* Real payment processing
* Advanced enterprise SSO
* Complex approval workflow
* Complex PDF parsing pipeline
* Full vector database RAG unless simple to implement
* Multi-organization membership per user
* Admin billing
* Marketplace features

---

## 5. MVP RAG Approach

For the MVP, implement **RAG-lite**.

This means:

1. Tenant Admin creates business domains.
2. Tenant Admin uploads or pastes reference document text.
3. The document text is stored against the business domain.
4. When a story is reviewed, the user selects a business domain.
5. The AI prompt includes the most relevant stored reference text for that domain.

Do not block the MVP on advanced embeddings, PDF parsing, or vector search.

A simple approach is acceptable:

* Store document title and extracted / pasted text.
* Retrieve the latest active documents for the selected domain.
* Include the top few text snippets in the AI prompt.
* Ask the AI to provide domain-aware feedback.

Add comments in the code showing where vector search can be added later.

---

## 6. User Roles

Implement four roles:

1. `TENANT_ADMIN`
2. `PROJECT_MANAGER`
3. `BA_PO`
4. `VIEWER`

### Permissions

| Feature                    | Tenant Admin | Project Manager | BA / PO | Viewer |
| -------------------------- | -----------: | --------------: | ------: | -----: |
| Manage tenant              |          Yes |              No |      No |     No |
| Create project             |          Yes |             Yes |      No |     No |
| View project               |          Yes |             Yes |     Yes |    Yes |
| Create business domain     |          Yes |              No |      No |     No |
| Upload domain documents    |          Yes |              No |      No |     No |
| Create user story          |          Yes |             Yes |     Yes |     No |
| Submit story for AI review |          Yes |             Yes |     Yes |     No |
| View story review          |          Yes |             Yes |     Yes |    Yes |
| View personal dashboard    |          Yes |             Yes |     Yes |    Yes |
| View team dashboard        |          Yes |             Yes |      No |     No |

---

## 7. Tenant Isolation Rules

Tenant isolation is mandatory.

Every tenant-owned table must include `tenant_id`.

The app must never trust `tenant_id` sent from the frontend.

Always derive `tenant_id` from the authenticated user profile.

A user from Tenant A must never access:

* Tenant B projects
* Tenant B stories
* Tenant B reviews
* Tenant B business domains
* Tenant B documents
* Tenant B KPIs

---

## 8. Core Pages to Build

### Public Pages

1. `/`

   * Landing page
   * Explain StoryScore AI
   * CTA to sign up or log in

2. `/login`

   * Login form

3. `/signup`

   * Sign-up form

### Protected Pages

4. `/dashboard`

   * Personal BA dashboard
   * KPI cards
   * My stories list

5. `/projects`

   * List projects
   * Create project if authorized

6. `/projects/[projectId]`

   * Project detail
   * Stories under project

7. `/stories/new`

   * Create story
   * Select project
   * Select business domain
   * Enter story fields
   * Submit for AI review

8. `/stories/[storyId]`

   * Story detail
   * Latest AI review
   * Review history

9. `/domains`

   * Business domain management
   * Tenant Admin only for create/edit

10. `/domains/[domainId]`

* Domain detail
* Documents list
* Upload or paste reference document text

11. `/admin`

* Basic tenant admin page
* Show users and roles if simple to implement
* Optional for MVP if time is limited

---

## 9. Story Quality Scoring Model

Use this scoring model:

| Category                         | Weight |
| -------------------------------- | -----: |
| User role clarity                |     10 |
| Business value clarity           |     15 |
| Functional clarity               |     15 |
| Acceptance criteria quality      |     20 |
| INVEST compliance                |     20 |
| Edge cases and alternative paths |     10 |
| Testability                      |     10 |
| Total                            |    100 |

### Readiness Status

|  Score | Status            |
| -----: | ----------------- |
| 90–100 | Excellent         |
|  80–89 | Ready             |
|  65–79 | Needs Improvement |
|   0–64 | Not Ready         |

---

## 10. AI Review Output

The AI must return structured JSON.

Required response:

```json
{
  "overallScore": 0,
  "qualityLevel": "",
  "readinessStatus": "",
  "scoreBreakdown": {
    "roleClarity": 0,
    "businessValue": 0,
    "functionalClarity": 0,
    "acceptanceCriteria": 0,
    "investCompliance": 0,
    "edgeCases": 0,
    "testability": 0
  },
  "domainAlignmentScore": 0,
  "strengths": [],
  "weaknesses": [],
  "missingDomainRules": [],
  "domainSpecificRisks": [],
  "improvedUserStory": "",
  "improvedAcceptanceCriteria": [],
  "suggestedBusinessRules": [],
  "suggestedEdgeCases": [],
  "referencedDocuments": [],
  "recommendation": ""
}
```

Validate the structure before saving.

---

## 11. BA Improvement KPIs

The dashboard must show:

1. Total stories created
2. Average first submission score
3. Average final score
4. AI Dependency Index
5. Ready-on-first-submission rate
6. Quality trend
7. Most common weakness

### AI Dependency Index

```text
AI Dependency Index = Average Final Score - Average First Submission Score
```

The goal is that this decreases over time.

### Ready-on-First-Submission Rate

```text
Stories with first_submission_score >= 80 / total stories
```

### Quality Trend

Compare latest five first-submission scores against previous five.

* Difference >= 5: Improving
* Difference between -5 and 5: Stable
* Difference <= -5: Declining

---

## 12. Required Tests

Create at least 3 meaningful tests.

Recommended tests:

1. Story validation test
2. AI prompt builder test
3. KPI calculation test
4. Permission rule test

Use Vitest.

---

## 13. Code Quality Rules

* Use TypeScript.
* Avoid `any` unless justified.
* Keep AI calls server-side.
* Do not expose API keys to the frontend.
* Keep components small.
* Keep business logic in `/lib`.
* Validate user input before AI calls.
* Handle AI API errors gracefully.
* Do not commit `.env.local`.
* Use clear names for functions and files.

---

## 14. Final Build Checklist

Before finishing, confirm:

* User can sign up and log in.
* User belongs to a tenant.
* User can create a project.
* Tenant Admin can create a business domain.
* Tenant Admin can add reference document text.
* User can create a story and select domain.
* User can submit story for AI review.
* AI returns structured review.
* Review is saved.
* Dashboard shows stories and KPIs.
* Tenant filtering is applied.
* Tests pass.
* GitHub Actions exists.
* `.env.example` exists.
* README is complete.
* App is deployable on Vercel.
