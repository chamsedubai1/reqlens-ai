# ReqLens AI — Plan 2A: Postgres Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-hosted PostgreSQL data layer with Drizzle ORM — the 8-table schema, generated SQL migrations, a connection client, and a tenant-scoped `/lib/db` query API — all integration-tested against in-memory PGlite so CI needs no external database.

**Architecture:** Drizzle ORM defines the schema in TypeScript; `drizzle-kit` generates SQL migrations. `/lib/db` is the ONLY module that touches Postgres; every query function takes a `db` handle and a `tenantId` and scopes rows by tenant. Production uses a `node-postgres` Pool from `DATABASE_URL`; tests use PGlite (in-memory Postgres) with the same migrations applied, so the exact schema is exercised without a server.

**Tech Stack:** Drizzle ORM, drizzle-kit, node-postgres (`pg`), `@electric-sql/pglite` (tests), Vitest.

## Global Constraints

- Product name: **ReqLens AI**. Language: TypeScript, no `any` unless justified with a comment.
- The database is **self-hosted PostgreSQL** (no Supabase). App reads `DATABASE_URL` from env.
- `/lib/db` is the ONLY module that talks to Postgres. Every tenant-owned query is scoped by a
  `tenantId` derived from the caller (never from client input). Tenant A must never read Tenant B's rows.
- Every tenant-owned table has a `tenant_id` column.
- `story_reviews` keeps the 7 per-category score columns plus `domain_alignment_score`.
- All 8 tables from the design's Data Model (§4) must exist: `tenants`, `user_profiles`, `projects`,
  `business_domains`, `domain_documents`, `user_stories`, `story_reviews`, `audit_logs`.
- Roles: `TENANT_ADMIN`, `PROJECT_MANAGER`, `BA_PO`, `VIEWER`.
- Node 20+. Package manager: npm. Migrations live in `db/migrations`.

---

### Task 1: Install deps, Drizzle config, DB client, PGlite test harness

**Files:**
- Modify: `package.json` (add dependencies + `db:generate` / `db:migrate` scripts)
- Create: `drizzle.config.ts`
- Create: `lib/db/client.ts`
- Create: `lib/db/test-db.ts`
- Test: `tests/db/client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier plans.
- Produces:
  - `lib/db/client.ts` → `function getDb(): NodePgDatabase<typeof schema>` (lazy singleton Pool from `DATABASE_URL`) and `export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>`.
  - `lib/db/test-db.ts` → `async function createTestDb(): Promise<{ db: PgliteDatabase<typeof schema>; close: () => Promise<void> }>` — an in-memory PGlite database with all migrations applied. (Schema import is wired in Task 2; in Task 1 the harness runs without a schema object.)

- [ ] **Step 1: Add dependencies and scripts to `package.json`**

Add to `dependencies`:
```
"drizzle-orm": "0.38.3",
"pg": "8.13.1"
```
Add to `devDependencies`:
```
"@electric-sql/pglite": "0.2.14",
"@types/pg": "8.11.10",
"drizzle-kit": "0.30.1"
```
Add to `scripts`:
```
"db:generate": "drizzle-kit generate",
"db:migrate": "node --import tsx scripts/migrate.mjs"
```
Note: the `db:migrate` production runner script is created in Task 2 (Step 6). For now just add the two script lines and the deps.

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs cleanly, no peer-dep errors that block.

- [ ] **Step 3: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/reqlens",
  },
});
```

- [ ] **Step 4: Create `lib/db/client.ts`**

```ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

// A Db handle is satisfied by either the production node-postgres driver or the
// PGlite test driver — both expose the same Drizzle query API over our schema.
export type Db =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

// Lazy singleton so importing this module never requires DATABASE_URL until a query runs.
export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  }
  return db;
}
```

Note: this file imports `@/lib/db/schema`, which is created in Task 2. It will not typecheck until Task 2 is done — that is expected; Task 1's test (Step 6) does not import this file.

- [ ] **Step 5: Create `lib/db/test-db.ts`**

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";

// Spins up an isolated in-memory Postgres (PGlite), applies the committed SQL
// migrations, and returns a Drizzle handle. Used by every data-layer test so CI
// exercises the real schema without a database server.
export async function createTestDb(): Promise<{
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./db/migrations" });
  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}
```

Note: also imports `@/lib/db/schema` (Task 2) and the migrations folder (generated in Task 2). Task 1's test does not import this file either.

- [ ] **Step 6: Write the Task 1 test (raw PGlite + Drizzle connectivity, no schema)**

`tests/db/client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

describe("db stack connectivity", () => {
  it("runs a query through Drizzle on an in-memory PGlite database", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    const rows = await db.execute(sql`select 1 as one`);
    // PGlite returns rows on the `.rows` property.
    expect(rows.rows[0]).toEqual({ one: 1 });
    await client.close();
  });
});
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/db/client.test.ts`
Expected: PASS — proves pglite + drizzle work end to end.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts lib/db/client.ts lib/db/test-db.ts tests/db/client.test.ts
git commit -m "chore: add Drizzle + pg + pglite data-layer scaffolding"
```

---

### Task 2: Schema (8 tables) + generated migration + schema test

**Files:**
- Create: `lib/db/schema.ts`
- Create (generated): `db/migrations/*.sql` and `db/migrations/meta/*` (via drizzle-kit)
- Create: `scripts/migrate.mjs` (production migration runner)
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `createTestDb()` from `lib/db/test-db.ts`.
- Produces: `lib/db/schema.ts` exporting Drizzle tables `tenants`, `userProfiles`, `projects`,
  `businessDomains`, `domainDocuments`, `userStories`, `storyReviews`, `auditLogs`, and the
  `userRole` pgEnum. Column names are snake_case in SQL; the TS property names are camelCase.

- [ ] **Step 1: Write the schema**

`lib/db/schema.ts`:
```ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "TENANT_ADMIN",
  "PROJECT_MANAGER",
  "BA_PO",
  "VIEWER",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const businessDomains = pgTable("business_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const domainDocuments = pgTable("domain_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  title: text("title").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  contentText: text("content_text"),
  processingStatus: text("processing_status").notNull().default("PROCESSED"),
  documentSummary: text("document_summary"),
  uploadedBy: uuid("uploaded_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userStories = pgTable("user_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  title: text("title").notNull(),
  userRole: text("user_role").notNull(),
  goal: text("goal").notNull(),
  businessValue: text("business_value").notNull(),
  description: text("description").notNull(),
  acceptanceCriteria: text("acceptance_criteria"),
  businessRules: text("business_rules"),
  edgeCases: text("edge_cases"),
  status: text("status").notNull().default("DRAFT"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const storyReviews = pgTable("story_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  storyId: uuid("story_id")
    .notNull()
    .references(() => userStories.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  firstSubmissionScore: integer("first_submission_score").notNull(),
  finalScore: integer("final_score").notNull(),
  improvementGap: integer("improvement_gap").notNull(),
  aiDependencyLevel: text("ai_dependency_level").notNull(),
  readinessStatus: text("readiness_status").notNull(),
  roleClarityScore: integer("role_clarity_score"),
  businessValueScore: integer("business_value_score"),
  functionalClarityScore: integer("functional_clarity_score"),
  acceptanceCriteriaScore: integer("acceptance_criteria_score"),
  investScore: integer("invest_score"),
  edgeCaseScore: integer("edge_case_score"),
  testabilityScore: integer("testability_score"),
  domainAlignmentScore: integer("domain_alignment_score"),
  strengths: jsonb("strengths"),
  weaknesses: jsonb("weaknesses"),
  missingDomainRules: jsonb("missing_domain_rules"),
  domainSpecificRisks: jsonb("domain_specific_risks"),
  improvedUserStory: text("improved_user_story"),
  improvedAcceptanceCriteria: jsonb("improved_acceptance_criteria"),
  suggestedBusinessRules: jsonb("suggested_business_rules"),
  suggestedEdgeCases: jsonb("suggested_edge_cases"),
  referencedDocuments: jsonb("referenced_documents"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id").references(() => userProfiles.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: creates `db/migrations/0000_*.sql` (CREATE TYPE user_role; CREATE TABLE for all 8 tables) plus a `db/migrations/meta/` folder. Inspect the SQL file to confirm all 8 tables and the enum are present.

- [ ] **Step 3: Create the production migration runner `scripts/migrate.mjs`**

```js
// Applies committed SQL migrations to the database in DATABASE_URL.
// Usage: npm run db:migrate  (requires tsx: npx is invoked via the package script)
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./db/migrations" });
await pool.end();
console.log("Migrations applied.");
```

Add `tsx` to devDependencies so the runner can be invoked (`"tsx": "4.19.2"`), then run `npm install`.

- [ ] **Step 4: Write the schema test**

`tests/db/schema.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/lib/db/test-db";
import { tenants, userProfiles } from "@/lib/db/schema";

let close: (() => Promise<void>) | undefined;

afterEach(async () => {
  if (close) await close();
  close = undefined;
});

describe("schema + migrations", () => {
  it("creates tenants and user_profiles and enforces the tenant FK", async () => {
    const t = await createTestDb();
    close = t.close;
    const { db } = t;

    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Acme" })
      .returning();
    expect(tenant.id).toBeTruthy();

    const [profile] = await db
      .insert(userProfiles)
      .values({
        tenantId: tenant.id,
        fullName: "Priya Sharma",
        email: "priya@acme.test",
        passwordHash: "hash",
        role: "TENANT_ADMIN",
      })
      .returning();
    expect(profile.role).toBe("TENANT_ADMIN");
    expect(profile.status).toBe("ACTIVE");

    const found = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.tenantId, tenant.id));
    expect(found).toHaveLength(1);
    expect(found[0].email).toBe("priya@acme.test");
  });

  it("rejects a user_profile with a non-existent tenant_id", async () => {
    const t = await createTestDb();
    close = t.close;
    const { db } = t;

    await expect(
      db.insert(userProfiles).values({
        tenantId: "00000000-0000-0000-0000-000000000000",
        fullName: "Nobody",
        email: "nobody@x.test",
        passwordHash: "hash",
        role: "VIEWER",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: PASS — both cases green (insert + FK rejection).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: exit 0 (now that `lib/db/schema.ts` exists, `client.ts` and `test-db.ts` typecheck).

```bash
git add lib/db/schema.ts db/migrations scripts/migrate.mjs package.json package-lock.json tests/db/schema.test.ts
git commit -m "feat: add Drizzle schema, generated migrations, and migration runner"
```

---

### Task 3: Tenant-scoped `/lib/db` query API + isolation tests

**Files:**
- Create: `lib/db/queries.ts`
- Test: `tests/db/queries.test.ts`

**Interfaces:**
- Consumes: `Db` type from `lib/db/client.ts`; schema tables; `createTestDb()`.
- Produces (all exported from `@/lib/db/queries`; every tenant-owned function is scoped by `tenantId`):
  - `getUserProfileByEmail(db, email): Promise<UserProfile | undefined>`
  - `createUserWithTenant(db, input: { fullName; email; passwordHash; tenantName }): Promise<{ userId: string; tenantId: string }>` — single transaction creating tenant + TENANT_ADMIN profile.
  - `createProject(db, tenantId, createdBy, input: { name; description? }): Promise<Project>`
  - `listProjects(db, tenantId): Promise<Project[]>`
  - `createDomain(db, tenantId, createdBy, input: { name; description? }): Promise<BusinessDomain>`
  - `listDomains(db, tenantId): Promise<BusinessDomain[]>`
  - `createStory(db, tenantId, createdBy, input: StoryRow): Promise<UserStory>`
  - `listStoriesByUser(db, tenantId, userId): Promise<UserStory[]>`
  - Types `UserProfile`, `Project`, `BusinessDomain`, `UserStory` inferred from the schema.

- [ ] **Step 1: Write the failing test**

`tests/db/queries.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant,
  getUserProfileByEmail,
  createProject,
  listProjects,
  createDomain,
  createStory,
  listStoriesByUser,
} from "@/lib/db/queries";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  if (close) await close();
  close = undefined;
});

async function seedTenant(db: Awaited<ReturnType<typeof createTestDb>>["db"], name: string) {
  return createUserWithTenant(db, {
    fullName: `Admin ${name}`,
    email: `admin@${name}.test`,
    passwordHash: "hash",
    tenantName: name,
  });
}

describe("createUserWithTenant", () => {
  it("creates a tenant and a TENANT_ADMIN profile atomically", async () => {
    const t = await createTestDb();
    close = t.close;
    const { userId, tenantId } = await seedTenant(t.db, "acme");
    expect(userId).toBeTruthy();
    expect(tenantId).toBeTruthy();

    const profile = await getUserProfileByEmail(t.db, "admin@acme.test");
    expect(profile?.role).toBe("TENANT_ADMIN");
    expect(profile?.tenantId).toBe(tenantId);
  });
});

describe("tenant isolation", () => {
  it("listProjects returns only the caller tenant's projects", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seedTenant(t.db, "alpha");
    const b = await seedTenant(t.db, "beta");

    await createProject(t.db, a.tenantId, a.userId, { name: "Alpha App" });
    await createProject(t.db, b.tenantId, b.userId, { name: "Beta App" });

    const alphaProjects = await listProjects(t.db, a.tenantId);
    const betaProjects = await listProjects(t.db, b.tenantId);
    expect(alphaProjects.map((p) => p.name)).toEqual(["Alpha App"]);
    expect(betaProjects.map((p) => p.name)).toEqual(["Beta App"]);
  });

  it("listStoriesByUser never returns another tenant's stories", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seedTenant(t.db, "alpha");
    const b = await seedTenant(t.db, "beta");

    const domA = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });
    const projA = await createProject(t.db, a.tenantId, a.userId, { name: "A" });
    await createStory(t.db, a.tenantId, a.userId, {
      projectId: projA.id,
      domainId: domA.id,
      title: "A story",
      userRole: "customer",
      goal: "do things",
      businessValue: "value",
      description: "desc",
    });

    const bStories = await listStoriesByUser(t.db, b.tenantId, b.userId);
    expect(bStories).toHaveLength(0);
    const aStories = await listStoriesByUser(t.db, a.tenantId, a.userId);
    expect(aStories).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/queries.test.ts`
Expected: FAIL — cannot resolve `@/lib/db/queries`.

- [ ] **Step 3: Write the implementation**

`lib/db/queries.ts`:
```ts
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  tenants,
  userProfiles,
  projects,
  businessDomains,
  userStories,
} from "@/lib/db/schema";

export type UserProfile = typeof userProfiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type BusinessDomain = typeof businessDomains.$inferSelect;
export type UserStory = typeof userStories.$inferSelect;

export async function getUserProfileByEmail(
  db: Db,
  email: string,
): Promise<UserProfile | undefined> {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.email, email))
    .limit(1);
  return rows[0];
}

// Creates a new tenant and its first user (TENANT_ADMIN) in one transaction.
// tenant_id is generated server-side; never supplied by the client.
export async function createUserWithTenant(
  db: Db,
  input: {
    fullName: string;
    email: string;
    passwordHash: string;
    tenantName: string;
  },
): Promise<{ userId: string; tenantId: string }> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.tenantName })
      .returning();
    const [profile] = await tx
      .insert(userProfiles)
      .values({
        tenantId: tenant.id,
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "TENANT_ADMIN",
      })
      .returning();
    return { userId: profile.id, tenantId: tenant.id };
  });
}

export async function createProject(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: { name: string; description?: string },
): Promise<Project> {
  const [row] = await db
    .insert(projects)
    .values({
      tenantId,
      createdBy,
      name: input.name,
      description: input.description,
    })
    .returning();
  return row;
}

export async function listProjects(db: Db, tenantId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.tenantId, tenantId));
}

export async function createDomain(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: { name: string; description?: string },
): Promise<BusinessDomain> {
  const [row] = await db
    .insert(businessDomains)
    .values({
      tenantId,
      createdBy,
      name: input.name,
      description: input.description,
    })
    .returning();
  return row;
}

export async function listDomains(
  db: Db,
  tenantId: string,
): Promise<BusinessDomain[]> {
  return db
    .select()
    .from(businessDomains)
    .where(eq(businessDomains.tenantId, tenantId));
}

export type StoryRow = {
  projectId: string;
  domainId: string;
  title: string;
  userRole: string;
  goal: string;
  businessValue: string;
  description: string;
  acceptanceCriteria?: string;
  businessRules?: string;
  edgeCases?: string;
};

export async function createStory(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: StoryRow,
): Promise<UserStory> {
  const [row] = await db
    .insert(userStories)
    .values({ tenantId, createdBy, ...input })
    .returning();
  return row;
}

export async function listStoriesByUser(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<UserStory[]> {
  return db
    .select()
    .from(userStories)
    .where(
      and(
        eq(userStories.tenantId, tenantId),
        eq(userStories.createdBy, userId),
      ),
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/queries.test.ts`
Expected: PASS — createUserWithTenant + both isolation cases green.

- [ ] **Step 5: Full verification + commit**

Run: `npm test`
Expected: PASS — all suites (Plan 1 suites + the three db suites) green.

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add lib/db/queries.ts tests/db/queries.test.ts
git commit -m "feat: add tenant-scoped db query API with isolation tests"
```

---

## Plan 2A Self-Review

**Spec coverage:**
- Self-hosted Postgres via `DATABASE_URL`, no Supabase → Task 1 client. ✓
- All 8 tables with `tenant_id`; 7 review score columns + domain_alignment → Task 2 schema. ✓
- Migrations committed + prod runner → Task 2 (`db/migrations`, `scripts/migrate.mjs`). ✓
- `/lib/db` is the only Postgres module; every tenant query scoped by tenantId → Task 3. ✓
- Tenant isolation proven (A cannot see B) → Task 3 tests. ✓
- Keyless CI: PGlite harness, no external DB → Task 1/2 `test-db.ts`. ✓
- `createUserWithTenant` atomic tenant + TENANT_ADMIN provisioning (consumed by Plan 2B auth) → Task 3. ✓

**Placeholder scan:** No TBD/TODO; all steps contain concrete code and commands. The only forward
references (`client.ts`/`test-db.ts` importing `schema.ts`) are explicitly called out with the task
that resolves them. ✓

**Type consistency:** `Db` (Task 1) is used by all Task 3 functions; schema table/column names
(Task 2) match the property names used in queries and tests (Task 3); `createUserWithTenant`'s
return shape `{ userId, tenantId }` matches what Plan 2B's signup action will consume. ✓

**Deferred to Plan 2B (intentional):** `/lib/auth` (hashing, JWT, cookies), signup/login/logout,
middleware, session helpers, and the authed app shell.
