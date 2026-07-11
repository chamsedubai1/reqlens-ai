# ReqLens AI — Plan 4: AI Review + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the domain-aware AI story-review pipeline (with a keyless deterministic mock provider so it runs without an OpenAI key), persist reviews, surface the review on the story page, and render a real KPI dashboard.

**Architecture:** `/lib/ai` exposes `reviewStory(input)` behind a provider interface: an OpenAI implementation (used when `OPENAI_API_KEY` is set) and a deterministic mock (used otherwise), both returning JSON validated by `validateAIReview` (Plan 1). A pure mapper turns a validated `AIReview` into a `story_reviews` row; `/lib/db` persists it and reads reviews back tenant-scoped. A submit Server Action runs the pipeline; the story page shows the latest review; the dashboard computes KPIs via `/lib/kpi`.

**Tech Stack:** OpenAI REST via `fetch` (no SDK dep), zod, Next.js Server Actions/Components, Vitest, PGlite.

## Global Constraints

- Product name: **ReqLens AI**. TypeScript, no `any` unless justified with a comment.
- AI calls and `OPENAI_API_KEY` stay **server-side** only. When the key is unset, the deterministic
  mock provider is used so the whole flow works and tests pass with no external service.
- The AI response MUST be validated with `validateAIReview` (Plan 1 `/lib/scoring`) before being
  saved. A review that fails validation is never persisted.
- Canonical 7-category scoring; readiness via `readinessStatus`.
- The prompt must include: the scoring model, the story fields, the domain name/description, the
  relevant reference-document snippets, an instruction not to invent references, and an instruction
  to return JSON only. If no processed documents exist, the review states it used general agile
  criteria only.
- Everything tenant-scoped; only users with `submit_review` can trigger a review.
- KPI formulas from `/lib/kpi` (Plan 1): AI Dependency Index = avgFinal − avgFirst; ready-on-first
  = first≥80/total; quality trend last-5 vs prev-5.
- Node 20+, npm.

---

### Task 1: `/lib/ai` — prompt builder, mock + OpenAI providers, reviewStory — TDD

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/prompt.ts`
- Create: `lib/ai/mock.ts`
- Create: `lib/ai/openai.ts`
- Create: `lib/ai/index.ts`
- Test: `tests/ai/prompt.test.ts`
- Test: `tests/ai/mock.test.ts`
- Test: `tests/ai/review.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `type ReviewInput = { story: ReviewStoryFields; domain: { name: string; description?: string | null }; documents: { title: string; contentText: string }[] }` and `type ReviewStoryFields = { title: string; userRole: string; goal: string; businessValue: string; description: string; acceptanceCriteria?: string | null; businessRules?: string | null; edgeCases?: string | null }`.
  - `prompt.ts`: `buildReviewPrompt(input: ReviewInput): { system: string; user: string }`
  - `mock.ts`: `mockReview(input: ReviewInput): AIReview`
  - `openai.ts`: `openaiReview(input: ReviewInput): Promise<unknown>`
  - `index.ts`: `reviewStory(input: ReviewInput): Promise<AIReview>`

- [ ] **Step 1: Write the failing tests**

`tests/ai/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildReviewPrompt } from "@/lib/ai/prompt";
import type { ReviewInput } from "@/lib/ai/types";

const base: ReviewInput = {
  story: {
    title: "Transfer money to a saved beneficiary",
    userRole: "Retail banking customer",
    goal: "transfer money to a saved beneficiary",
    businessValue: "so payments are fast and secure",
    description: "As a customer I want to transfer money...",
    acceptanceCriteria: "User can pick a saved beneficiary.",
  },
  domain: { name: "Payments", description: "Fund transfers" },
  documents: [{ title: "Transfer Policy", contentText: "Transfers over 50000 require OTP." }],
};

describe("buildReviewPrompt", () => {
  it("includes the story title and fields", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("Transfer money to a saved beneficiary");
    expect(user).toContain("Retail banking customer");
    expect(user).toContain("User can pick a saved beneficiary.");
  });
  it("includes the scoring model categories", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("acceptanceCriteria");
    expect(user).toContain("investCompliance");
  });
  it("includes the domain name and document text", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("Payments");
    expect(user).toContain("Transfers over 50000 require OTP.");
  });
  it("instructs the model not to invent references and to return JSON", () => {
    const { system } = buildReviewPrompt(base);
    expect(system.toLowerCase()).toContain("json");
    expect(system.toLowerCase()).toContain("do not invent");
  });
  it("states general-agile-only when there are no documents", () => {
    const { user } = buildReviewPrompt({ ...base, documents: [] });
    expect(user.toLowerCase()).toContain("general agile");
  });
});
```

`tests/ai/mock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mockReview } from "@/lib/ai/mock";
import { validateAIReview } from "@/lib/scoring";
import type { ReviewInput } from "@/lib/ai/types";

const input: ReviewInput = {
  story: {
    title: "T",
    userRole: "customer",
    goal: "do things",
    businessValue: "value",
    description: "desc",
    acceptanceCriteria: "AC present",
    edgeCases: "an edge case",
  },
  domain: { name: "Payments", description: null },
  documents: [{ title: "Policy", contentText: "rule" }],
};

describe("mockReview", () => {
  it("returns a schema-valid AIReview", () => {
    const review = mockReview(input);
    expect(() => validateAIReview(review)).not.toThrow();
  });
  it("is deterministic for the same input", () => {
    expect(mockReview(input)).toEqual(mockReview(input));
  });
  it("scores higher when acceptance criteria and edge cases are present", () => {
    const withExtras = mockReview(input);
    const without = mockReview({
      ...input,
      story: { ...input.story, acceptanceCriteria: null, edgeCases: null },
    });
    expect(withExtras.overallScore).toBeGreaterThan(without.overallScore);
  });
  it("notes missing documents when none are provided", () => {
    const review = mockReview({ ...input, documents: [] });
    expect(review.missingDomainRules.join(" ").toLowerCase()).toContain("no domain reference");
  });
});
```

`tests/ai/review.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reviewStory } from "@/lib/ai/index";
import { validateAIReview } from "@/lib/scoring";
import type { ReviewInput } from "@/lib/ai/types";

const input: ReviewInput = {
  story: {
    title: "T",
    userRole: "customer",
    goal: "g",
    businessValue: "v",
    description: "d",
  },
  domain: { name: "Payments" },
  documents: [],
};

describe("reviewStory", () => {
  const original = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  it("uses the mock provider and returns a validated review when no key is set", async () => {
    const review = await reviewStory(input);
    expect(() => validateAIReview(review)).not.toThrow();
    expect(review.overallScore).toBeGreaterThanOrEqual(0);
    expect(review.overallScore).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ai/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the types**

`lib/ai/types.ts`:
```ts
export type ReviewStoryFields = {
  title: string;
  userRole: string;
  goal: string;
  businessValue: string;
  description: string;
  acceptanceCriteria?: string | null;
  businessRules?: string | null;
  edgeCases?: string | null;
};

export type ReviewInput = {
  story: ReviewStoryFields;
  domain: { name: string; description?: string | null };
  documents: { title: string; contentText: string }[];
};
```

- [ ] **Step 4: Implement the prompt builder**

`lib/ai/prompt.ts`:
```ts
import type { ReviewInput } from "@/lib/ai/types";
import { SCORE_WEIGHTS } from "@/lib/scoring";

const REQUIRED_JSON_SHAPE = `{
  "overallScore": 0, "qualityLevel": "", "readinessStatus": "",
  "scoreBreakdown": { "roleClarity": 0, "businessValue": 0, "functionalClarity": 0, "acceptanceCriteria": 0, "investCompliance": 0, "edgeCases": 0, "testability": 0 },
  "domainAlignmentScore": 0, "strengths": [], "weaknesses": [], "missingDomainRules": [], "domainSpecificRisks": [],
  "improvedUserStory": "", "improvedAcceptanceCriteria": [], "suggestedBusinessRules": [], "suggestedEdgeCases": [],
  "referencedDocuments": [], "recommendation": ""
}`;

export function buildReviewPrompt(input: ReviewInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are ReqLens AI, an expert agile Business Analyst that reviews user stories.",
    "Assess the story on agile quality, INVEST, testability, acceptance-criteria quality, and business-domain alignment.",
    "Use ONLY the provided reference documents for domain claims. Do not invent references or rules that are not supported by the documents.",
    "Clearly list any missing domain-specific rules.",
    "Respond with a single JSON object and nothing else — no markdown, no prose.",
    `The JSON must match exactly this shape: ${REQUIRED_JSON_SHAPE}`,
    `Category maximum scores: ${JSON.stringify(SCORE_WEIGHTS)} (they sum to 100 and equal overallScore).`,
  ].join("\n");

  const docs =
    input.documents.length > 0
      ? input.documents
          .map((d, i) => `Document ${i + 1} — ${d.title}:\n${d.contentText}`)
          .join("\n\n")
      : "No domain reference documents were provided. Base the review on general agile criteria only and set domainAlignmentScore conservatively.";

  const s = input.story;
  const user = [
    `Business domain: ${input.domain.name}${input.domain.description ? ` — ${input.domain.description}` : ""}`,
    "",
    "Reference documents:",
    docs,
    "",
    "User story to review:",
    `Title: ${s.title}`,
    `User role: ${s.userRole}`,
    `Goal: ${s.goal}`,
    `Business value: ${s.businessValue}`,
    `Description: ${s.description}`,
    `Acceptance criteria: ${s.acceptanceCriteria ?? "(none)"}`,
    `Business rules: ${s.businessRules ?? "(none)"}`,
    `Edge cases: ${s.edgeCases ?? "(none)"}`,
    "",
    "Score each category up to its maximum (see system message), and return the JSON object.",
  ].join("\n");

  return { system, user };
}
```

- [ ] **Step 5: Implement the mock provider**

`lib/ai/mock.ts`:
```ts
import type { ReviewInput } from "@/lib/ai/types";
import { readinessStatus, type AIReview } from "@/lib/scoring";

function filled(value?: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// Deterministic, schema-valid review. Scores scale with story completeness so the
// demo (and the dashboard) show meaningful variation without an OpenAI key.
export function mockReview(input: ReviewInput): AIReview {
  const s = input.story;
  const hasDocs = input.documents.length > 0;

  const scoreBreakdown = {
    roleClarity: filled(s.userRole) ? 9 : 4,
    businessValue: filled(s.businessValue) ? 13 : 6,
    functionalClarity: filled(s.description) ? 12 : 6,
    acceptanceCriteria: filled(s.acceptanceCriteria) ? 17 : 8,
    investCompliance: filled(s.goal) ? 16 : 9,
    edgeCases: filled(s.edgeCases) ? 8 : 3,
    testability: filled(s.acceptanceCriteria) ? 8 : 4,
  };
  const overallScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

  const weaknesses: string[] = [];
  if (!filled(s.acceptanceCriteria)) weaknesses.push("Acceptance Criteria");
  if (!filled(s.edgeCases)) weaknesses.push("Edge Cases");
  if (!filled(s.businessValue)) weaknesses.push("Business Value");

  return {
    overallScore,
    qualityLevel: overallScore >= 80 ? "Good" : "Needs work",
    readinessStatus: readinessStatus(overallScore),
    scoreBreakdown,
    domainAlignmentScore: hasDocs ? 88 : 60,
    strengths: [
      filled(s.userRole) ? "Clear user role" : "Has a stated goal",
      filled(s.businessValue) ? "Business value is articulated" : "Concise",
    ],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Minor wording improvements"],
    missingDomainRules: hasDocs
      ? []
      : ["No domain reference documents were provided; review used general agile criteria only."],
    domainSpecificRisks: hasDocs ? ["Verify limits against the referenced policy."] : [],
    improvedUserStory: `As a ${s.userRole}, I want to ${s.goal} so that ${s.businessValue}.`,
    improvedAcceptanceCriteria: [
      "Given a valid input, when the action is performed, then the expected outcome occurs.",
      "The system validates required fields and shows clear errors.",
    ],
    suggestedBusinessRules: hasDocs
      ? ["Apply the thresholds defined in the referenced documents."]
      : ["Define validation thresholds for the primary action."],
    suggestedEdgeCases: [
      "What happens on invalid or missing input?",
      "What happens when a limit is exceeded?",
    ],
    referencedDocuments: input.documents.map((d) => d.title),
    recommendation:
      overallScore >= 80
        ? "Ready with minor improvements."
        : "Needs improvement before sprint planning.",
  };
}
```

- [ ] **Step 6: Implement the OpenAI provider**

`lib/ai/openai.ts`:
```ts
import type { ReviewInput } from "@/lib/ai/types";
import { buildReviewPrompt } from "@/lib/ai/prompt";

// Calls the OpenAI Chat Completions API and returns the parsed JSON (unvalidated).
// Uses fetch to avoid an SDK dependency. Throws on any non-OK response.
export async function openaiReview(input: ReviewInput): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const { system, user } = buildReviewPrompt(input);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return JSON.parse(content);
}
```

- [ ] **Step 7: Implement the entry point**

`lib/ai/index.ts`:
```ts
import type { ReviewInput } from "@/lib/ai/types";
import { validateAIReview, type AIReview } from "@/lib/scoring";
import { mockReview } from "@/lib/ai/mock";
import { openaiReview } from "@/lib/ai/openai";

// Runs the review through OpenAI when a key is configured, otherwise the
// deterministic mock. The result is always validated before being returned;
// an invalid structure throws (callers must not persist an invalid review).
// TODO: vector search — retrieve the most relevant document chunks here before
// building the prompt, instead of passing whole documents.
export async function reviewStory(input: ReviewInput): Promise<AIReview> {
  const raw = process.env.OPENAI_API_KEY
    ? await openaiReview(input)
    : mockReview(input);
  return validateAIReview(raw);
}

export type { ReviewInput } from "@/lib/ai/types";
```

- [ ] **Step 8: Run tests + commit**

Run: `npx vitest run tests/ai/` → PASS. Run: `npm test` (all green), `npx tsc --noEmit` (exit 0).
```bash
git add lib/ai tests/ai
git commit -m "feat: add AI review pipeline (prompt builder, mock + OpenAI providers)"
```

---

### Task 2: Review persistence + KPI aggregation — TDD

**Files:**
- Create: `lib/review/record.ts`
- Modify: `lib/db/queries.ts` (createReview, getFirstReviewScoreForStory, listReviewsForKpi, setStoryStatus)
- Modify: `lib/kpi.ts` (add `latestReviewPerStory`)
- Test: `tests/review/record.test.ts`
- Test: `tests/db/reviews.test.ts`
- Test: `tests/kpi-latest.test.ts`

**Interfaces:**
- Produces:
  - `record.ts`: `type ReviewInsert = {...}`; `buildReviewInsert(review: AIReview, previousFirstScore: number | null): ReviewInsert`; `dependencyLevel(gap: number): "Low" | "Medium" | "High"`.
  - `queries.ts`: `createReview(db, tenantId, ctx: { storyId; projectId; domainId; userId }, insert: ReviewInsert): Promise<StoryReview>`; `getFirstReviewScoreForStory(db, tenantId, storyId): Promise<number | null>`; `listReviewsForKpi(db, tenantId, userId): Promise<KpiReviewRow[]>`; `setStoryStatus(db, tenantId, storyId, status): Promise<void>`. Types `StoryReview`, `KpiReviewRow = { storyId: string; firstSubmissionScore: number; finalScore: number; weaknesses: string[]; createdAt: string }`.
  - `kpi.ts`: `latestReviewPerStory(rows: KpiReviewLike[]): StoryReviewRecord[]` where `KpiReviewLike = { storyId: string; firstSubmissionScore: number; finalScore: number; weaknesses: string[]; createdAt: string }`.

- [ ] **Step 1: Write the failing tests**

`tests/review/record.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildReviewInsert, dependencyLevel } from "@/lib/review/record";
import type { AIReview } from "@/lib/scoring";

const review: AIReview = {
  overallScore: 85,
  qualityLevel: "Good",
  readinessStatus: "Ready",
  scoreBreakdown: {
    roleClarity: 9, businessValue: 13, functionalClarity: 12,
    acceptanceCriteria: 17, investCompliance: 16, edgeCases: 8, testability: 10,
  },
  domainAlignmentScore: 88,
  strengths: ["a"], weaknesses: ["Edge Cases"], missingDomainRules: [], domainSpecificRisks: [],
  improvedUserStory: "As a...", improvedAcceptanceCriteria: ["ac"], suggestedBusinessRules: ["r"],
  suggestedEdgeCases: ["e"], referencedDocuments: ["Doc"], recommendation: "ok",
};

describe("dependencyLevel", () => {
  it("maps the improvement gap to a level", () => {
    expect(dependencyLevel(3)).toBe("Low");
    expect(dependencyLevel(12)).toBe("Medium");
    expect(dependencyLevel(25)).toBe("High");
  });
});

describe("buildReviewInsert", () => {
  it("uses the overall score as first + final on the first review", () => {
    const row = buildReviewInsert(review, null);
    expect(row.firstSubmissionScore).toBe(85);
    expect(row.finalScore).toBe(85);
    expect(row.improvementGap).toBe(0);
    expect(row.acceptanceCriteriaScore).toBe(17);
    expect(row.readinessStatus).toBe("Ready");
  });
  it("keeps the earlier first score and computes the gap on a re-review", () => {
    const row = buildReviewInsert(review, 65);
    expect(row.firstSubmissionScore).toBe(65);
    expect(row.finalScore).toBe(85);
    expect(row.improvementGap).toBe(20);
    expect(row.aiDependencyLevel).toBe("High");
  });
});
```

`tests/db/reviews.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant, createProject, createDomain, createStory,
  createReview, getFirstReviewScoreForStory, listReviewsForKpi, setStoryStatus, getStory,
} from "@/lib/db/queries";
import { buildReviewInsert } from "@/lib/review/record";
import { mockReview } from "@/lib/ai/mock";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { if (close) await close(); close = undefined; });

async function setup(db: Awaited<ReturnType<typeof createTestDb>>["db"]) {
  const a = await createUserWithTenant(db, { fullName: "A", email: "a@a.test", passwordHash: "h", tenantName: "a" });
  const domain = await createDomain(db, a.tenantId, a.userId, { name: "Payments" });
  const project = await createProject(db, a.tenantId, a.userId, { name: "P" });
  const story = await createStory(db, a.tenantId, a.userId, {
    projectId: project.id, domainId: domain.id, title: "S",
    userRole: "customer", goal: "g", businessValue: "v", description: "d",
    acceptanceCriteria: "AC",
  });
  return { ...a, domain, project, story };
}

describe("review persistence", () => {
  it("saves a review, preserves the first score, and lists KPI rows", async () => {
    const t = await createTestDb();
    close = t.close;
    const s = await setup(t.db);
    const ctx = { storyId: s.story.id, projectId: s.project.id, domainId: s.domain.id, userId: s.userId };

    const review = mockReview({
      story: s.story, domain: { name: "Payments" }, documents: [],
    });
    const prevFirst = await getFirstReviewScoreForStory(t.db, s.tenantId, s.story.id);
    expect(prevFirst).toBeNull();
    await createReview(t.db, s.tenantId, ctx, buildReviewInsert(review, prevFirst));
    await setStoryStatus(t.db, s.tenantId, s.story.id, "REVIEWED");

    expect((await getStory(t.db, s.tenantId, s.story.id))?.status).toBe("REVIEWED");
    const firstAfter = await getFirstReviewScoreForStory(t.db, s.tenantId, s.story.id);
    expect(firstAfter).toBe(review.overallScore);

    const rows = await listReviewsForKpi(t.db, s.tenantId, s.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].storyId).toBe(s.story.id);
    expect(Array.isArray(rows[0].weaknesses)).toBe(true);
  });

  it("does not return another tenant's review rows", async () => {
    const t = await createTestDb();
    close = t.close;
    const s = await setup(t.db);
    const other = await createUserWithTenant(t.db, { fullName: "B", email: "b@b.test", passwordHash: "h", tenantName: "b" });
    const ctx = { storyId: s.story.id, projectId: s.project.id, domainId: s.domain.id, userId: s.userId };
    await createReview(t.db, s.tenantId, ctx, buildReviewInsert(mockReview({ story: s.story, domain: { name: "P" }, documents: [] }), null));

    expect(await listReviewsForKpi(t.db, other.tenantId, other.userId)).toHaveLength(0);
  });
});
```

`tests/kpi-latest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { latestReviewPerStory } from "@/lib/kpi";

describe("latestReviewPerStory", () => {
  it("keeps only the most recent review per story", () => {
    const rows = [
      { storyId: "s1", firstSubmissionScore: 60, finalScore: 70, weaknesses: ["A"], createdAt: "2026-01-01" },
      { storyId: "s1", firstSubmissionScore: 60, finalScore: 85, weaknesses: ["A"], createdAt: "2026-01-02" },
      { storyId: "s2", firstSubmissionScore: 80, finalScore: 80, weaknesses: [], createdAt: "2026-01-01" },
    ];
    const records = latestReviewPerStory(rows);
    expect(records).toHaveLength(2);
    const s1 = records.find((r) => r.finalScore === 85 || r.finalScore === 70);
    expect(s1?.finalScore).toBe(85);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/review/ tests/db/reviews.test.ts tests/kpi-latest.test.ts`
Expected: FAIL — modules/functions not found.

- [ ] **Step 3: Implement `lib/review/record.ts`**

```ts
import type { AIReview } from "@/lib/scoring";

export type ReviewInsert = {
  firstSubmissionScore: number;
  finalScore: number;
  improvementGap: number;
  aiDependencyLevel: string;
  readinessStatus: string;
  roleClarityScore: number;
  businessValueScore: number;
  functionalClarityScore: number;
  acceptanceCriteriaScore: number;
  investScore: number;
  edgeCaseScore: number;
  testabilityScore: number;
  domainAlignmentScore: number;
  strengths: string[];
  weaknesses: string[];
  missingDomainRules: string[];
  domainSpecificRisks: string[];
  improvedUserStory: string;
  improvedAcceptanceCriteria: string[];
  suggestedBusinessRules: string[];
  suggestedEdgeCases: string[];
  referencedDocuments: string[];
  recommendation: string;
};

export function dependencyLevel(gap: number): "Low" | "Medium" | "High" {
  if (gap >= 20) return "High";
  if (gap >= 10) return "Medium";
  return "Low";
}

// Maps a validated AIReview to a story_reviews insert. On the first review the
// overall score is both first and final; on a re-review the earlier first score
// is preserved and the improvement gap is computed against it.
export function buildReviewInsert(
  review: AIReview,
  previousFirstScore: number | null,
): ReviewInsert {
  const firstSubmissionScore = previousFirstScore ?? review.overallScore;
  const finalScore = review.overallScore;
  const improvementGap = finalScore - firstSubmissionScore;
  const b = review.scoreBreakdown;
  return {
    firstSubmissionScore,
    finalScore,
    improvementGap,
    aiDependencyLevel: dependencyLevel(improvementGap),
    readinessStatus: review.readinessStatus,
    roleClarityScore: b.roleClarity,
    businessValueScore: b.businessValue,
    functionalClarityScore: b.functionalClarity,
    acceptanceCriteriaScore: b.acceptanceCriteria,
    investScore: b.investCompliance,
    edgeCaseScore: b.edgeCases,
    testabilityScore: b.testability,
    domainAlignmentScore: review.domainAlignmentScore,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    missingDomainRules: review.missingDomainRules,
    domainSpecificRisks: review.domainSpecificRisks,
    improvedUserStory: review.improvedUserStory,
    improvedAcceptanceCriteria: review.improvedAcceptanceCriteria,
    suggestedBusinessRules: review.suggestedBusinessRules,
    suggestedEdgeCases: review.suggestedEdgeCases,
    referencedDocuments: review.referencedDocuments,
    recommendation: review.recommendation,
  };
}
```

- [ ] **Step 4: Extend `lib/db/queries.ts`**

Add `storyReviews` to the schema import at the top. Add `desc, asc` to the drizzle-orm import
(so the import becomes `import { and, eq, asc, desc } from "drizzle-orm";`). Append:
```ts
import type { ReviewInsert } from "@/lib/review/record";

export type StoryReview = typeof storyReviews.$inferSelect;
export type KpiReviewRow = {
  storyId: string;
  firstSubmissionScore: number;
  finalScore: number;
  weaknesses: string[];
  createdAt: string;
};

export async function createReview(
  db: Db,
  tenantId: string,
  ctx: { storyId: string; projectId: string; domainId: string; userId: string },
  insert: ReviewInsert,
): Promise<StoryReview> {
  const [row] = await db
    .insert(storyReviews)
    .values({ tenantId, ...ctx, ...insert })
    .returning();
  return row;
}

export async function getFirstReviewScoreForStory(
  db: Db,
  tenantId: string,
  storyId: string,
): Promise<number | null> {
  const rows = await db
    .select({ score: storyReviews.firstSubmissionScore })
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.storyId, storyId)))
    .orderBy(asc(storyReviews.createdAt))
    .limit(1);
  return rows[0]?.score ?? null;
}

export async function listReviewsForKpi(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<KpiReviewRow[]> {
  const rows = await db
    .select({
      storyId: storyReviews.storyId,
      firstSubmissionScore: storyReviews.firstSubmissionScore,
      finalScore: storyReviews.finalScore,
      weaknesses: storyReviews.weaknesses,
      createdAt: storyReviews.createdAt,
    })
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.userId, userId)))
    .orderBy(desc(storyReviews.createdAt));
  return rows.map((r) => ({
    storyId: r.storyId,
    firstSubmissionScore: r.firstSubmissionScore,
    finalScore: r.finalScore,
    weaknesses: Array.isArray(r.weaknesses) ? (r.weaknesses as string[]) : [],
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getLatestReviewForStory(
  db: Db,
  tenantId: string,
  storyId: string,
): Promise<StoryReview | undefined> {
  const rows = await db
    .select()
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.storyId, storyId)))
    .orderBy(desc(storyReviews.createdAt))
    .limit(1);
  return rows[0];
}

export async function setStoryStatus(
  db: Db,
  tenantId: string,
  storyId: string,
  status: string,
): Promise<void> {
  await db
    .update(userStories)
    .set({ status })
    .where(and(eq(userStories.tenantId, tenantId), eq(userStories.id, storyId)));
}
```

- [ ] **Step 5: Add `latestReviewPerStory` to `lib/kpi.ts`**

Append:
```ts
export function latestReviewPerStory(
  rows: {
    storyId: string;
    firstSubmissionScore: number;
    finalScore: number;
    weaknesses: string[];
    createdAt: string;
  }[],
): StoryReviewRecord[] {
  const byStory = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const current = byStory.get(row.storyId);
    if (!current || row.createdAt > current.createdAt) {
      byStory.set(row.storyId, row);
    }
  }
  return [...byStory.values()].map((r) => ({
    firstSubmissionScore: r.firstSubmissionScore,
    finalScore: r.finalScore,
    weaknesses: r.weaknesses,
    createdAt: r.createdAt,
  }));
}
```

- [ ] **Step 6: Run tests + commit**

Run: `npx vitest run tests/review/ tests/db/reviews.test.ts tests/kpi-latest.test.ts` → PASS.
Run: `npm test` (all green), `npx tsc --noEmit` (exit 0).
```bash
git add lib/review/record.ts lib/db/queries.ts lib/kpi.ts tests/review tests/db/reviews.test.ts tests/kpi-latest.test.ts
git commit -m "feat: add review persistence, first-score preservation, and KPI aggregation"
```

---

### Task 3: Wiring — submit-review action, story review UI, dashboard (glue)

**Files:**
- Create: `app/actions/review.ts`
- Create: `components/ScoreRing.tsx`
- Create: `components/ReviewSummary.tsx`
- Modify: `app/(app)/stories/[storyId]/page.tsx` (show latest review + submit button)
- Modify: `app/(app)/dashboard/page.tsx` (real KPIs + My Stories table)

**Interfaces:**
- Consumes: `reviewStory` (`@/lib/ai`), `buildReviewInsert` (`@/lib/review/record`), the new
  `/lib/db` review queries, `/lib/kpi` (aggregations + `latestReviewPerStory`), `/lib/auth/guard`.

This is framework glue; verified by `tsc --noEmit`, `npm run build`, and the documented manual smoke test.

- [ ] **Step 1: Submit-review server action**

`app/actions/review.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  getStory, getDomain, listProcessedDocumentsByDomain,
  createReview, getFirstReviewScoreForStory, setStoryStatus,
} from "@/lib/db/queries";
import { reviewStory } from "@/lib/ai";
import { buildReviewInsert } from "@/lib/review/record";

export async function submitStoryForReviewAction(formData: FormData): Promise<void> {
  const profile = await requireCan("submit_review");
  const storyId = String(formData.get("storyId") ?? "");
  const db = getDb();

  const story = await getStory(db, profile.tenantId, storyId);
  if (!story) redirect("/dashboard?error=" + encodeURIComponent("Story not found."));

  const domain = await getDomain(db, profile.tenantId, story.domainId);
  const documents = await listProcessedDocumentsByDomain(db, profile.tenantId, story.domainId);

  try {
    const review = await reviewStory({
      story: {
        title: story.title, userRole: story.userRole, goal: story.goal,
        businessValue: story.businessValue, description: story.description,
        acceptanceCriteria: story.acceptanceCriteria, businessRules: story.businessRules,
        edgeCases: story.edgeCases,
      },
      domain: { name: domain?.name ?? "General", description: domain?.description },
      documents: documents.map((d) => ({ title: d.title, contentText: d.contentText ?? "" })),
    });
    const previousFirst = await getFirstReviewScoreForStory(db, profile.tenantId, storyId);
    await createReview(
      db,
      profile.tenantId,
      { storyId, projectId: story.projectId, domainId: story.domainId, userId: profile.id },
      buildReviewInsert(review, previousFirst),
    );
    await setStoryStatus(db, profile.tenantId, storyId, "REVIEWED");
  } catch {
    redirect(`/stories/${storyId}?error=` + encodeURIComponent("The AI review could not be completed. Please try again."));
  }
  redirect(`/stories/${storyId}`);
}
```

- [ ] **Step 2: ScoreRing component**

`components/ScoreRing.tsx`:
```tsx
// Pure inline-SVG score ring (0–100). No external chart dependency (CSP-safe).
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 80 ? "#16a34a" : clamped >= 65 ? "#d97706" : "#dc2626";
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
      />
      <text x="50" y="49" textAnchor="middle" className="fill-slate-900" fontSize="20" fontWeight="700">
        {clamped}
      </text>
      <text x="50" y="64" textAnchor="middle" className="fill-slate-400" fontSize="9">/ 100</text>
    </svg>
  );
}
```

- [ ] **Step 3: ReviewSummary component**

`components/ReviewSummary.tsx`:
```tsx
import { ScoreRing } from "@/components/ScoreRing";
import type { StoryReview } from "@/lib/db/queries";

function List({ title, items }: { title: string; items: unknown }) {
  const arr = Array.isArray(items) ? (items as string[]) : [];
  if (arr.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="ml-4 list-disc text-sm text-slate-600">
        {arr.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export function ReviewSummary({ review }: { review: StoryReview }) {
  return (
    <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-6">
        <ScoreRing score={review.finalScore} />
        <div>
          <div className="text-lg font-semibold text-slate-900">{review.readinessStatus}</div>
          <div className="text-sm text-slate-500">
            Domain alignment: {review.domainAlignmentScore ?? "—"} · AI dependency: {review.aiDependencyLevel}
          </div>
          <p className="mt-1 text-sm text-slate-600">{review.recommendation}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Strengths" items={review.strengths} />
        <List title="Weaknesses" items={review.weaknesses} />
        <List title="Missing domain rules" items={review.missingDomainRules} />
        <List title="Domain-specific risks" items={review.domainSpecificRisks} />
      </div>
      {review.improvedUserStory && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Improved user story</h3>
          <p className="text-sm text-slate-600">{review.improvedUserStory}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Suggested acceptance criteria" items={review.improvedAcceptanceCriteria} />
        <List title="Suggested business rules" items={review.suggestedBusinessRules} />
        <List title="Suggested edge cases" items={review.suggestedEdgeCases} />
        <List title="Referenced documents" items={review.referencedDocuments} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Story detail page — show review + submit**

Replace `app/(app)/stories/[storyId]/page.tsx` with:
```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getStory, getLatestReviewForStory } from "@/lib/db/queries";
import { submitStoryForReviewAction } from "@/app/actions/review";
import { ReviewSummary } from "@/components/ReviewSummary";
import { PermissionGate } from "@/components/PermissionGate";

export default async function StoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { storyId } = await params;
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const story = await getStory(db, profile.tenantId, storyId);
  if (!story) notFound();
  const review = await getLatestReviewForStory(db, profile.tenantId, storyId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{story.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{story.status}</span>
        </div>
        <PermissionGate role={profile.role} action="submit_review">
          <form action={submitStoryForReviewAction}>
            <input type="hidden" name="storyId" value={storyId} />
            <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
              {review ? "Re-run AI review" : "Submit for AI review"}
            </button>
          </form>
        </PermissionGate>
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <dl className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <div><dt className="font-medium text-slate-500">As a</dt><dd>{story.userRole}</dd></div>
        <div><dt className="font-medium text-slate-500">I want</dt><dd>{story.goal}</dd></div>
        <div><dt className="font-medium text-slate-500">So that</dt><dd>{story.businessValue}</dd></div>
        <div><dt className="font-medium text-slate-500">Description</dt><dd className="whitespace-pre-wrap">{story.description}</dd></div>
        {story.acceptanceCriteria && <div><dt className="font-medium text-slate-500">Acceptance criteria</dt><dd className="whitespace-pre-wrap">{story.acceptanceCriteria}</dd></div>}
      </dl>

      {review ? (
        <ReviewSummary review={review} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No AI review yet. Submit the story to get a quality score and improvements.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Dashboard — real KPIs + My Stories**

Replace `app/(app)/dashboard/page.tsx` with:
```tsx
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listStoriesByUser, listReviewsForKpi } from "@/lib/db/queries";
import {
  totalStories, averageFirstScore, averageFinalScore, aiDependencyIndex,
  readyOnFirstRate, qualityTrend, mostCommonWeakness, latestReviewPerStory,
} from "@/lib/kpi";

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const db = getDb();
  const [stories, kpiRows] = await Promise.all([
    listStoriesByUser(db, profile.tenantId, profile.id),
    listReviewsForKpi(db, profile.tenantId, profile.id),
  ]);
  const records = latestReviewPerStory(kpiRows);

  // Map storyId -> {first, final} from the freshest KPI row (kpiRows are createdAt desc,
  // so the first row seen per story is the latest review).
  const reviewByStory = new Map<string, { first: number; final: number }>();
  for (const r of kpiRows) {
    if (!reviewByStory.has(r.storyId)) {
      reviewByStory.set(r.storyId, { first: r.firstSubmissionScore, final: r.finalScore });
    }
  }

  const trend = qualityTrend(records);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile.fullName} 👋</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Total stories" value={String(totalStories(stories))} />
        <Card label="Avg first submission" value={String(averageFirstScore(records))} />
        <Card label="Avg final score" value={String(averageFinalScore(records))} />
        <Card label="AI Dependency Index" value={String(aiDependencyIndex(records))} hint="Lower is better over time" />
        <Card label="Ready on first" value={`${Math.round(readyOnFirstRate(records) * 100)}%`} />
        <Card label="Quality trend" value={trend} />
        <Card label="Most common weakness" value={mostCommonWeakness(records) ?? "—"} />
        <Card label="Reviewed stories" value={String(records.length)} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">My Stories</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Story</th><th className="p-3">Status</th>
                <th className="p-3">First</th><th className="p-3">Latest</th>
              </tr>
            </thead>
            <tbody>
              {stories.length === 0 && (
                <tr><td className="p-3 text-slate-500" colSpan={4}>No stories yet.</td></tr>
              )}
              {stories.map((s) => {
                const r = reviewByStory.get(s.id);
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="p-3"><a href={`/stories/${s.id}`} className="text-brand hover:underline">{s.title}</a></td>
                    <td className="p-3">{s.status}</td>
                    <td className="p-3">{r ? r.first : "—"}</td>
                    <td className="p-3">{r ? r.final : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck + build + tests**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run build` → succeeds; `/stories/[storyId]` and `/dashboard` compile.
Run: `npm test` → all green.

- [ ] **Step 7: Commit**

```bash
git add "app/actions/review.ts" components/ScoreRing.tsx components/ReviewSummary.tsx "app/(app)/stories/[storyId]/page.tsx" "app/(app)/dashboard/page.tsx"
git commit -m "feat: wire AI review submit, story review UI, and KPI dashboard"
```

---

## Manual Smoke Test (running Postgres + migrations; OPENAI_API_KEY optional)

1. Create a project, a domain, add a reference document, and create a story.
2. Open the story → "Submit for AI review" → the review summary (score ring, breakdown, strengths,
   improvements, referenced documents) appears; status becomes REVIEWED.
3. Dashboard shows updated KPI cards and the story in My Stories with first/latest scores.
4. Re-run the review → improvement gap / AI dependency reflect the change.
5. With `OPENAI_API_KEY` unset the mock runs; setting a valid key switches to live with no code change.

---

## Plan 4 Self-Review

**Spec coverage:** domain-aware AI review with the required structured output (§10) → Task 1 +
`validateAIReview`; prompt includes scoring model/story/domain/docs/no-invent/JSON (§ RAG) → Task 1;
review saved only after validation (§ reliability) → Task 1/2; first-submission + final + dependency
+ readiness persisted (§4.8) → Task 2; dashboard KPIs incl. AI Dependency Index, ready-on-first,
quality trend, most common weakness (§11) → Task 2/3; story workspace shows review (§ pages) →
Task 3; keyless mock so it runs without a key → Task 1. ✓

**Placeholder scan:** the `// TODO: vector search` marker in `lib/ai/index.ts` is the spec-mandated
extension point, not an unfinished requirement. No dead code. ✓

**Type consistency:** `ReviewInput`/`AIReview` (Task 1) → `buildReviewInsert`→`ReviewInsert` (Task 2)
→ `createReview` values; `KpiReviewRow`/`latestReviewPerStory`→`StoryReviewRecord` feed the KPI
functions (Task 3). ✓

**Deferred to Plan 5:** GitHub Actions CI, README with Hostinger deploy steps, `.env.example` final
check, secret audit.
