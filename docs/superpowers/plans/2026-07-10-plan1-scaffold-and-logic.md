# ReqLens AI — Plan 1: Scaffold + Pure Business Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a booting Next.js + TypeScript + Tailwind app with Vitest, and build the four keyless, pure-logic `/lib` modules (validation, rbac, scoring, kpi) test-first so CI is green without any external credentials.

**Architecture:** Next.js App Router configured for Hostinger (`output: 'standalone'`). All business logic lives in `/lib` as pure functions with no I/O, making them unit-testable under Vitest's node environment without Supabase or OpenAI. Later plans wire these modules into data access, auth, and UI.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 3.4, Vitest 2, zod 3.

## Global Constraints

- Product name in all user-facing copy: **ReqLens AI** (never "StoryScore AI").
- Language: TypeScript. Do not use `any` unless justified with a comment.
- All business logic lives in `/lib`; keep files focused and small.
- No secrets committed. `.env.local` and `.env` are git-ignored (already in `.gitignore`).
- Node.js 20+ assumed (Hostinger Node hosting / VPS).
- Package manager: **npm**.
- Canonical scoring model is **7 categories** with weights: roleClarity 10, businessValue 15, functionalClarity 15, acceptanceCriteria 20, investCompliance 20, edgeCases 10, testability 10 (total 100).
- Readiness status thresholds: 90–100 Excellent, 80–89 Ready, 65–79 Needs Improvement, 0–64 Not Ready.

---

### Task 1: Project scaffold (Next.js + Tailwind + Vitest, Hostinger-ready)

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `.eslintrc.json`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.env.example`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: an npm project with scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`; the `@/*` import alias mapped to the repo root.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "reqlens-ai",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "@types/react": "19.0.7",
    "@types/react-dom": "19.0.3",
    "autoprefixer": "10.4.20",
    "eslint": "9.18.0",
    "eslint-config-next": "15.1.6",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.17",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Create config files**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so the app can be run on a Hostinger VPS with `node .next/standalone/server.js` behind nginx/PM2.
  output: "standalone",
};

export default nextConfig;
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

`postcss.config.mjs`:
```js
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
export default config;
```

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ReqLens AI brand blue (from the logo/mockups).
        brand: {
          DEFAULT: "#2b7fff",
          dark: "#1e63d6",
          light: "#e8f1ff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
```

`.eslintrc.json`:
```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 3: Create app shell + landing page**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
```

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReqLens AI",
  description: "Domain-Aware Requirements Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-brand">ReqLens AI</h1>
      <p className="text-lg text-slate-600">
        Domain-Aware Requirements Intelligence — score, improve, and track the
        quality of your agile user stories.
      </p>
      <div className="flex gap-4">
        <a
          href="/signup"
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Get started
        </a>
        <a
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
        >
          Log in
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `.env.example`**

```bash
# Supabase (added in Plan 2). Get these from your Supabase project settings.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI (added in Plan 4). When unset, the app uses the deterministic mock reviewer.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 5: Write the smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: dependencies install, `node_modules/` created, no errors.

- [ ] **Step 7: Verify test harness, typecheck, and build**

Run: `npm test`
Expected: PASS — 1 passed (smoke test).

Run: `npm run typecheck`
Expected: no output, exit 0.

Run: `npm run build`
Expected: build completes; a `.next/standalone` directory is produced.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json next.config.mjs tsconfig.json next-env.d.ts postcss.config.mjs tailwind.config.ts vitest.config.ts .eslintrc.json app .env.example tests/smoke.test.ts
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest (Hostinger standalone)"
```

---

### Task 2: `/lib/rbac.ts` — role-based permission helper (TDD)

**Files:**
- Create: `lib/rbac.ts`
- Test: `tests/rbac.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Role = 'TENANT_ADMIN' | 'PROJECT_MANAGER' | 'BA_PO' | 'VIEWER'`
  - `type Action` (the union listed below)
  - `function can(role: Role, action: Action): boolean`

- [ ] **Step 1: Write the failing test**

`tests/rbac.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { can } from "@/lib/rbac";

describe("can()", () => {
  it("lets TENANT_ADMIN manage the tenant", () => {
    expect(can("TENANT_ADMIN", "manage_tenant")).toBe(true);
  });

  it("forbids PROJECT_MANAGER from managing the tenant", () => {
    expect(can("PROJECT_MANAGER", "manage_tenant")).toBe(false);
  });

  it("lets PROJECT_MANAGER create a project but not a domain", () => {
    expect(can("PROJECT_MANAGER", "create_project")).toBe(true);
    expect(can("PROJECT_MANAGER", "create_domain")).toBe(false);
  });

  it("lets BA_PO create and submit stories but not create projects", () => {
    expect(can("BA_PO", "create_story")).toBe(true);
    expect(can("BA_PO", "submit_review")).toBe(true);
    expect(can("BA_PO", "create_project")).toBe(false);
  });

  it("forbids VIEWER from creating stories but allows viewing", () => {
    expect(can("VIEWER", "create_story")).toBe(false);
    expect(can("VIEWER", "view_review")).toBe(true);
    expect(can("VIEWER", "view_personal_dashboard")).toBe(true);
  });

  it("restricts team dashboard to admins and project managers", () => {
    expect(can("TENANT_ADMIN", "view_team_dashboard")).toBe(true);
    expect(can("PROJECT_MANAGER", "view_team_dashboard")).toBe(true);
    expect(can("BA_PO", "view_team_dashboard")).toBe(false);
    expect(can("VIEWER", "view_team_dashboard")).toBe(false);
  });

  it("allows only admin and project manager to delete stories", () => {
    expect(can("TENANT_ADMIN", "delete_story")).toBe(true);
    expect(can("PROJECT_MANAGER", "delete_story")).toBe(true);
    expect(can("BA_PO", "delete_story")).toBe(false);
    expect(can("VIEWER", "delete_story")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rbac.test.ts`
Expected: FAIL — cannot resolve `@/lib/rbac`.

- [ ] **Step 3: Write minimal implementation**

`lib/rbac.ts`:
```ts
export type Role = "TENANT_ADMIN" | "PROJECT_MANAGER" | "BA_PO" | "VIEWER";

export type Action =
  | "manage_tenant"
  | "create_project"
  | "view_project"
  | "create_domain"
  | "upload_document"
  | "create_story"
  | "submit_review"
  | "view_review"
  | "view_personal_dashboard"
  | "view_team_dashboard"
  | "delete_story";

// Permission matrix from the spec (CLAUDE.md section 6 + spec section 4.10).
// Each action lists the roles permitted to perform it.
const PERMISSIONS: Record<Action, Role[]> = {
  manage_tenant: ["TENANT_ADMIN"],
  create_project: ["TENANT_ADMIN", "PROJECT_MANAGER"],
  view_project: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  create_domain: ["TENANT_ADMIN"],
  upload_document: ["TENANT_ADMIN"],
  create_story: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO"],
  submit_review: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO"],
  view_review: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  view_personal_dashboard: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  view_team_dashboard: ["TENANT_ADMIN", "PROJECT_MANAGER"],
  delete_story: ["TENANT_ADMIN", "PROJECT_MANAGER"],
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[action].includes(role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rbac.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/rbac.ts tests/rbac.test.ts
git commit -m "feat: add role-based permission helper (can)"
```

---

### Task 3: `/lib/scoring.ts` — scoring model, readiness status, AI-review validation (TDD)

**Files:**
- Create: `lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: `zod` (already a dependency).
- Produces:
  - `const SCORE_WEIGHTS` (the 7-category weights)
  - `type ReadinessStatus = 'Excellent' | 'Ready' | 'Needs Improvement' | 'Not Ready'`
  - `function readinessStatus(overallScore: number): ReadinessStatus`
  - `type AIReview` (the validated review object)
  - `function validateAIReview(data: unknown): AIReview` — zod-parses; throws `ZodError` on invalid input.

- [ ] **Step 1: Write the failing test**

`tests/scoring.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  readinessStatus,
  validateAIReview,
} from "@/lib/scoring";

const validReview = {
  overallScore: 82,
  qualityLevel: "Good",
  readinessStatus: "Ready",
  scoreBreakdown: {
    roleClarity: 8,
    businessValue: 13,
    functionalClarity: 12,
    acceptanceCriteria: 16,
    investCompliance: 17,
    edgeCases: 8,
    testability: 8,
  },
  domainAlignmentScore: 90,
  strengths: ["Clear role"],
  weaknesses: ["Few edge cases"],
  missingDomainRules: [],
  domainSpecificRisks: [],
  improvedUserStory: "As a user...",
  improvedAcceptanceCriteria: ["AC1"],
  suggestedBusinessRules: ["Rule 1"],
  suggestedEdgeCases: ["Edge 1"],
  referencedDocuments: ["Policy v1"],
  recommendation: "Ready with minor improvements",
};

describe("SCORE_WEIGHTS", () => {
  it("sums to 100", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe("readinessStatus", () => {
  it("maps score bands to statuses", () => {
    expect(readinessStatus(95)).toBe("Excellent");
    expect(readinessStatus(90)).toBe("Excellent");
    expect(readinessStatus(85)).toBe("Ready");
    expect(readinessStatus(80)).toBe("Ready");
    expect(readinessStatus(70)).toBe("Needs Improvement");
    expect(readinessStatus(65)).toBe("Needs Improvement");
    expect(readinessStatus(40)).toBe("Not Ready");
    expect(readinessStatus(0)).toBe("Not Ready");
  });
});

describe("validateAIReview", () => {
  it("accepts a well-formed review", () => {
    const parsed = validateAIReview(validReview);
    expect(parsed.overallScore).toBe(82);
    expect(parsed.scoreBreakdown.acceptanceCriteria).toBe(16);
  });

  it("throws when a required field is missing", () => {
    const bad = { ...validReview };
    // @ts-expect-error deliberately removing a required field
    delete bad.scoreBreakdown;
    expect(() => validateAIReview(bad)).toThrow();
  });

  it("throws when overallScore is out of range", () => {
    expect(() => validateAIReview({ ...validReview, overallScore: 150 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL — cannot resolve `@/lib/scoring`.

- [ ] **Step 3: Write minimal implementation**

`lib/scoring.ts`:
```ts
import { z } from "zod";

// Canonical 7-category weighting (CLAUDE.md section 9). Sums to 100.
export const SCORE_WEIGHTS = {
  roleClarity: 10,
  businessValue: 15,
  functionalClarity: 15,
  acceptanceCriteria: 20,
  investCompliance: 20,
  edgeCases: 10,
  testability: 10,
} as const;

export type ReadinessStatus =
  | "Excellent"
  | "Ready"
  | "Needs Improvement"
  | "Not Ready";

export function readinessStatus(overallScore: number): ReadinessStatus {
  if (overallScore >= 90) return "Excellent";
  if (overallScore >= 80) return "Ready";
  if (overallScore >= 65) return "Needs Improvement";
  return "Not Ready";
}

const scoreBreakdownSchema = z.object({
  roleClarity: z.number().min(0).max(SCORE_WEIGHTS.roleClarity),
  businessValue: z.number().min(0).max(SCORE_WEIGHTS.businessValue),
  functionalClarity: z.number().min(0).max(SCORE_WEIGHTS.functionalClarity),
  acceptanceCriteria: z.number().min(0).max(SCORE_WEIGHTS.acceptanceCriteria),
  investCompliance: z.number().min(0).max(SCORE_WEIGHTS.investCompliance),
  edgeCases: z.number().min(0).max(SCORE_WEIGHTS.edgeCases),
  testability: z.number().min(0).max(SCORE_WEIGHTS.testability),
});

// Mirrors the required AI response contract (CLAUDE.md section 10).
export const aiReviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  qualityLevel: z.string(),
  readinessStatus: z.string(),
  scoreBreakdown: scoreBreakdownSchema,
  domainAlignmentScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingDomainRules: z.array(z.string()),
  domainSpecificRisks: z.array(z.string()),
  improvedUserStory: z.string(),
  improvedAcceptanceCriteria: z.array(z.string()),
  suggestedBusinessRules: z.array(z.string()),
  suggestedEdgeCases: z.array(z.string()),
  referencedDocuments: z.array(z.string()),
  recommendation: z.string(),
});

export type AIReview = z.infer<typeof aiReviewSchema>;

// Throws ZodError if the structure is invalid — callers must never persist an unvalidated review.
export function validateAIReview(data: unknown): AIReview {
  return aiReviewSchema.parse(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: add scoring model, readiness mapping, and AI review validation"
```

---

### Task 4: `/lib/kpi.ts` — dashboard KPI calculations (TDD)

**Files:**
- Create: `lib/kpi.ts`
- Test: `tests/kpi.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface StoryReviewRecord { firstSubmissionScore: number; finalScore: number; weaknesses: string[]; createdAt: string }`
  - `type QualityTrend = 'Improving' | 'Stable' | 'Declining'`
  - `function totalStories(records: StoryReviewRecord[]): number`
  - `function averageFirstScore(records: StoryReviewRecord[]): number`
  - `function averageFinalScore(records: StoryReviewRecord[]): number`
  - `function aiDependencyIndex(records: StoryReviewRecord[]): number`
  - `function readyOnFirstRate(records: StoryReviewRecord[]): number`
  - `function qualityTrend(records: StoryReviewRecord[]): QualityTrend`
  - `function mostCommonWeakness(records: StoryReviewRecord[]): string | null`

  Averages are rounded to the nearest integer. `qualityTrend` orders records by `createdAt` ascending, then compares the mean of the latest 5 first-submission scores against the previous 5.

- [ ] **Step 1: Write the failing test**

`tests/kpi.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  StoryReviewRecord,
  totalStories,
  averageFirstScore,
  averageFinalScore,
  aiDependencyIndex,
  readyOnFirstRate,
  qualityTrend,
  mostCommonWeakness,
} from "@/lib/kpi";

function rec(
  first: number,
  final: number,
  createdAt: string,
  weaknesses: string[] = [],
): StoryReviewRecord {
  return { firstSubmissionScore: first, finalScore: final, createdAt, weaknesses };
}

describe("basic aggregates", () => {
  const records = [
    rec(60, 80, "2026-01-01"),
    rec(70, 90, "2026-01-02"),
    rec(80, 100, "2026-01-03"),
  ];

  it("counts stories", () => {
    expect(totalStories(records)).toBe(3);
  });

  it("averages first and final scores", () => {
    expect(averageFirstScore(records)).toBe(70);
    expect(averageFinalScore(records)).toBe(90);
  });

  it("computes AI dependency index as final minus first average", () => {
    expect(aiDependencyIndex(records)).toBe(20);
  });

  it("computes ready-on-first rate (first >= 80)", () => {
    expect(readyOnFirstRate(records)).toBeCloseTo(1 / 3);
  });

  it("returns 0 for empty inputs without dividing by zero", () => {
    expect(averageFirstScore([])).toBe(0);
    expect(aiDependencyIndex([])).toBe(0);
    expect(readyOnFirstRate([])).toBe(0);
  });
});

describe("qualityTrend", () => {
  function series(firstScores: number[]): StoryReviewRecord[] {
    return firstScores.map((s, i) =>
      rec(s, s, `2026-02-${String(i + 1).padStart(2, "0")}`),
    );
  }

  it("returns Improving when latest five average >= previous five + 5", () => {
    expect(qualityTrend(series([50, 50, 50, 50, 50, 60, 60, 60, 60, 60]))).toBe(
      "Improving",
    );
  });

  it("returns Declining when latest five average <= previous five - 5", () => {
    expect(qualityTrend(series([60, 60, 60, 60, 60, 50, 50, 50, 50, 50]))).toBe(
      "Declining",
    );
  });

  it("returns Stable when the difference is within +/- 5", () => {
    expect(qualityTrend(series([60, 60, 60, 60, 60, 62, 62, 62, 62, 62]))).toBe(
      "Stable",
    );
  });
});

describe("mostCommonWeakness", () => {
  it("returns the most frequent weakness", () => {
    const records = [
      rec(60, 80, "2026-01-01", ["Acceptance Criteria", "Edge Cases"]),
      rec(70, 90, "2026-01-02", ["Acceptance Criteria"]),
      rec(80, 100, "2026-01-03", ["Testability"]),
    ];
    expect(mostCommonWeakness(records)).toBe("Acceptance Criteria");
  });

  it("returns null when there are no weaknesses", () => {
    expect(mostCommonWeakness([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kpi.test.ts`
Expected: FAIL — cannot resolve `@/lib/kpi`.

- [ ] **Step 3: Write minimal implementation**

`lib/kpi.ts`:
```ts
export interface StoryReviewRecord {
  firstSubmissionScore: number;
  finalScore: number;
  weaknesses: string[];
  createdAt: string; // ISO date string
}

export type QualityTrend = "Improving" | "Stable" | "Declining";

export function totalStories(records: StoryReviewRecord[]): number {
  return records.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function averageFirstScore(records: StoryReviewRecord[]): number {
  return Math.round(mean(records.map((r) => r.firstSubmissionScore)));
}

export function averageFinalScore(records: StoryReviewRecord[]): number {
  return Math.round(mean(records.map((r) => r.finalScore)));
}

export function aiDependencyIndex(records: StoryReviewRecord[]): number {
  return averageFinalScore(records) - averageFirstScore(records);
}

export function readyOnFirstRate(records: StoryReviewRecord[]): number {
  if (records.length === 0) return 0;
  const ready = records.filter((r) => r.firstSubmissionScore >= 80).length;
  return ready / records.length;
}

export function qualityTrend(records: StoryReviewRecord[]): QualityTrend {
  const ordered = [...records].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const firstScores = ordered.map((r) => r.firstSubmissionScore);
  const latest5 = firstScores.slice(-5);
  const previous5 = firstScores.slice(-10, -5);
  const diff = mean(latest5) - mean(previous5);
  if (diff >= 5) return "Improving";
  if (diff <= -5) return "Declining";
  return "Stable";
}

export function mostCommonWeakness(
  records: StoryReviewRecord[],
): string | null {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const weakness of record.weaknesses) {
      counts.set(weakness, (counts.get(weakness) ?? 0) + 1);
    }
  }
  let top: string | null = null;
  let topCount = 0;
  for (const [weakness, count] of counts) {
    if (count > topCount) {
      top = weakness;
      topCount = count;
    }
  }
  return top;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kpi.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/kpi.ts tests/kpi.test.ts
git commit -m "feat: add KPI calculations (averages, AI dependency, trend, weakness)"
```

---

### Task 5: `/lib/validation.ts` — input schemas (TDD)

**Files:**
- Create: `lib/validation.ts`
- Test: `tests/validation.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces:
  - `const storyInputSchema` and `type StoryInput`
  - `const projectInputSchema` and `type ProjectInput`
  - `const domainInputSchema` and `type DomainInput`
  - `const documentInputSchema` and `type DocumentInput`

  Mandatory story fields (non-empty after trim): `projectId`, `domainId`, `title`, `userRole`, `goal`, `businessValue`, `description`. Optional: `acceptanceCriteria`, `businessRules`, `edgeCases`.

- [ ] **Step 1: Write the failing test**

`tests/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { storyInputSchema } from "@/lib/validation";

const validStory = {
  projectId: "11111111-1111-1111-1111-111111111111",
  domainId: "22222222-2222-2222-2222-222222222222",
  title: "Transfer money to a saved beneficiary",
  userRole: "Retail banking customer",
  goal: "transfer money to a saved beneficiary",
  businessValue: "so payments are fast and secure",
  description: "As a customer I want to transfer money...",
};

describe("storyInputSchema", () => {
  it("accepts a story with all mandatory fields", () => {
    const result = storyInputSchema.safeParse(validStory);
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = storyInputSchema.safeParse({ ...validStory, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only user role", () => {
    const result = storyInputSchema.safeParse({ ...validStory, userRole: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing goal", () => {
    const bad: Record<string, unknown> = { ...validStory };
    delete bad.goal;
    const result = storyInputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a missing business value", () => {
    const bad: Record<string, unknown> = { ...validStory };
    delete bad.businessValue;
    const result = storyInputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const result = storyInputSchema.safeParse(validStory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acceptanceCriteria).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validation.test.ts`
Expected: FAIL — cannot resolve `@/lib/validation`.

- [ ] **Step 3: Write minimal implementation**

`lib/validation.ts`:
```ts
import { z } from "zod";

const nonEmpty = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const storyInputSchema = z.object({
  projectId: nonEmpty("Project"),
  domainId: nonEmpty("Business domain"),
  title: nonEmpty("Story title"),
  userRole: nonEmpty("User role"),
  goal: nonEmpty("Goal"),
  businessValue: nonEmpty("Business value"),
  description: nonEmpty("Description"),
  acceptanceCriteria: z.string().optional(),
  businessRules: z.string().optional(),
  edgeCases: z.string().optional(),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

export const projectInputSchema = z.object({
  name: nonEmpty("Project name"),
  description: z.string().optional(),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const domainInputSchema = z.object({
  name: nonEmpty("Domain name"),
  description: z.string().optional(),
});
export type DomainInput = z.infer<typeof domainInputSchema>;

export const documentInputSchema = z.object({
  title: nonEmpty("Document title"),
  contentText: nonEmpty("Document content"),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/validation.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Full verification + commit**

Run: `npm test`
Expected: PASS — all suites (smoke, rbac, scoring, kpi, validation) green.

Run: `npm run typecheck`
Expected: exit 0, no errors.

```bash
git add lib/validation.ts tests/validation.test.ts
git commit -m "feat: add zod input schemas for story, project, domain, document"
```

---

## Plan 1 Self-Review

**Spec coverage (for this plan's scope):**
- Scaffold / stack (spec Phase 1) → Task 1. ✓
- Hostinger standalone output (design §2) → Task 1 `next.config.mjs`. ✓
- RBAC matrix (design §10, CLAUDE.md §6) → Task 2. ✓
- 7-category scoring + readiness + AI-JSON validation (design §7/§8) → Task 3. ✓
- KPI formulas incl. AI Dependency Index, ready-on-first, quality trend, common weakness (design §9) → Task 4. ✓
- Story/project/domain/document input validation (design §11, test plan) → Task 5. ✓
- Required tests: validation, permissions, KPI present here; prompt-builder test lands in Plan 4 with the AI module. ✓ (noted, not a gap for this plan)

**Placeholder scan:** No TBD/TODO/"handle appropriately" — all steps contain concrete code and commands. ✓

**Type consistency:** `Role`/`Action` (Task 2), `AIReview`/`ScoreBreakdown` keys (Task 3), `StoryReviewRecord` fields (Task 4), and schema field names (Task 5) are used consistently within their tasks and match the design doc's canonical scoring keys. ✓

**Deferred to later plans (intentional, not gaps):** `/lib/db`, `/lib/auth`, Supabase migrations/RLS, feature pages, AI provider + prompt builder, dashboard UI, CI workflow, Hostinger deploy docs.
