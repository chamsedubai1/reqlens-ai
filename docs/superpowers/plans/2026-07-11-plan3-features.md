# ReqLens AI — Plan 3: Projects, Domains, Documents, Stories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users create and view projects, business domains, domain reference documents, and user stories — every operation tenant-scoped and permission-checked server-side.

**Architecture:** Extend the tenant-scoped `/lib/db` query API with the reads/writes these features need. Add a server-side authorization guard (`assertCan` in `/lib/rbac` + `requireProfile`/`requireCan` in `/lib/auth/guard`). Feature pages are Server Components that read via `/lib/db`; mutations are Server Actions that (1) load the session profile, (2) assert permission, (3) validate input, (4) write scoped by the session's `tenant_id`.

**Tech Stack:** Next.js Server Actions + Server Components, Drizzle, zod, Vitest, PGlite (tests).

## Global Constraints

- Product name: **ReqLens AI**. TypeScript, no `any` unless justified with a comment.
- `/lib/db` is the ONLY module that touches Postgres; every tenant query is scoped by the session's
  `tenant_id`, never client input.
- Permissions enforced **server-side** on every mutation via the `can(role, action)` matrix — UI
  hiding is cosmetic only. Matrix (from CLAUDE.md §6 / spec §4.10):
  create_project → TENANT_ADMIN, PROJECT_MANAGER; create_domain → TENANT_ADMIN; upload_document →
  TENANT_ADMIN; create_story → TENANT_ADMIN, PROJECT_MANAGER, BA_PO. VIEWER creates nothing.
- Domain documents: MVP accepts pasted text OR an uploaded `.txt`/`.md` file (store its text).
  `processing_status` defaults to `PROCESSED`.
- Story mandatory fields: project, domain, title, userRole, goal, businessValue, description.
- A story's project and domain must belong to the caller's tenant (already enforced in `createStory`).
- Node 20+, npm.

---

### Task 1: Extend `/lib/db/queries` (gets, documents, per-project stories) — TDD

**Files:**
- Modify: `lib/db/queries.ts`
- Test: `tests/db/queries-features.test.ts`

**Interfaces:**
- Produces (all exported from `@/lib/db/queries`, all tenant-scoped):
  - `getProject(db, tenantId, id): Promise<Project | undefined>`
  - `getDomain(db, tenantId, id): Promise<BusinessDomain | undefined>`
  - `getStory(db, tenantId, id): Promise<UserStory | undefined>`
  - `listStoriesByProject(db, tenantId, projectId): Promise<UserStory[]>`
  - `createDocument(db, tenantId, uploadedBy, input: DocumentRow): Promise<DomainDocument>` — verifies the domain belongs to the tenant.
  - `listDocumentsByDomain(db, tenantId, domainId): Promise<DomainDocument[]>`
  - `listProcessedDocumentsByDomain(db, tenantId, domainId): Promise<DomainDocument[]>`
  - Types `DomainDocument`, `DocumentRow`.

- [ ] **Step 1: Write the failing test**

`tests/db/queries-features.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant,
  createProject,
  createDomain,
  createStory,
  getProject,
  getDomain,
  getStory,
  listStoriesByProject,
  createDocument,
  listDocumentsByDomain,
  listProcessedDocumentsByDomain,
} from "@/lib/db/queries";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  if (close) await close();
  close = undefined;
});

async function seed(db: Awaited<ReturnType<typeof createTestDb>>["db"], name: string) {
  return createUserWithTenant(db, {
    fullName: `Admin ${name}`,
    email: `admin@${name}.test`,
    passwordHash: "hash",
    tenantName: name,
  });
}

describe("tenant-scoped gets", () => {
  it("getProject/getDomain/getStory return the row for the owning tenant and undefined for others", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");

    const proj = await createProject(t.db, a.tenantId, a.userId, { name: "A App" });
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });
    const story = await createStory(t.db, a.tenantId, a.userId, {
      projectId: proj.id,
      domainId: dom.id,
      title: "S",
      userRole: "customer",
      goal: "g",
      businessValue: "v",
      description: "d",
    });

    expect((await getProject(t.db, a.tenantId, proj.id))?.name).toBe("A App");
    expect(await getProject(t.db, b.tenantId, proj.id)).toBeUndefined();
    expect((await getDomain(t.db, a.tenantId, dom.id))?.name).toBe("Payments");
    expect(await getDomain(t.db, b.tenantId, dom.id)).toBeUndefined();
    expect((await getStory(t.db, a.tenantId, story.id))?.title).toBe("S");
    expect(await getStory(t.db, b.tenantId, story.id)).toBeUndefined();
  });

  it("listStoriesByProject returns only that project's stories for the tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });
    const p1 = await createProject(t.db, a.tenantId, a.userId, { name: "P1" });
    const p2 = await createProject(t.db, a.tenantId, a.userId, { name: "P2" });
    const base = { domainId: dom.id, userRole: "c", goal: "g", businessValue: "v", description: "d" };
    await createStory(t.db, a.tenantId, a.userId, { projectId: p1.id, title: "one", ...base });
    await createStory(t.db, a.tenantId, a.userId, { projectId: p2.id, title: "two", ...base });

    const p1Stories = await listStoriesByProject(t.db, a.tenantId, p1.id);
    expect(p1Stories.map((s) => s.title)).toEqual(["one"]);
  });
});

describe("documents", () => {
  it("createDocument stores text and lists by domain; processed filter works", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });

    await createDocument(t.db, a.tenantId, a.userId, {
      domainId: dom.id,
      title: "Policy",
      contentText: "Transfers above 50000 require OTP.",
    });
    const docs = await listDocumentsByDomain(t.db, a.tenantId, dom.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].contentText).toContain("OTP");
    expect(docs[0].processingStatus).toBe("PROCESSED");

    const processed = await listProcessedDocumentsByDomain(t.db, a.tenantId, dom.id);
    expect(processed).toHaveLength(1);
  });

  it("createDocument rejects a domain from another tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");
    const domB = await createDomain(t.db, b.tenantId, b.userId, { name: "B" });
    await expect(
      createDocument(t.db, a.tenantId, a.userId, {
        domainId: domB.id,
        title: "X",
        contentText: "leak",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/queries-features.test.ts`
Expected: FAIL — the new functions are not exported.

- [ ] **Step 3: Implement (append to `lib/db/queries.ts`)**

Add `domainDocuments` to the existing schema import at the top of the file, then append:
```ts
export type DomainDocument = typeof domainDocuments.$inferSelect;

export async function getProject(
  db: Db,
  tenantId: string,
  id: string,
): Promise<Project | undefined> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function getDomain(
  db: Db,
  tenantId: string,
  id: string,
): Promise<BusinessDomain | undefined> {
  const rows = await db
    .select()
    .from(businessDomains)
    .where(and(eq(businessDomains.id, id), eq(businessDomains.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function getStory(
  db: Db,
  tenantId: string,
  id: string,
): Promise<UserStory | undefined> {
  const rows = await db
    .select()
    .from(userStories)
    .where(and(eq(userStories.id, id), eq(userStories.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function listStoriesByProject(
  db: Db,
  tenantId: string,
  projectId: string,
): Promise<UserStory[]> {
  return db
    .select()
    .from(userStories)
    .where(
      and(
        eq(userStories.tenantId, tenantId),
        eq(userStories.projectId, projectId),
      ),
    );
}

export type DocumentRow = {
  domainId: string;
  title: string;
  contentText: string;
  fileName?: string;
  fileType?: string;
};

export async function createDocument(
  db: Db,
  tenantId: string,
  uploadedBy: string,
  input: DocumentRow,
): Promise<DomainDocument> {
  // Verify the domain belongs to this tenant before attaching a document.
  const domain = await db
    .select({ id: businessDomains.id })
    .from(businessDomains)
    .where(
      and(
        eq(businessDomains.id, input.domainId),
        eq(businessDomains.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (domain.length === 0) {
    throw new Error("Business domain does not belong to this tenant");
  }
  const [row] = await db
    .insert(domainDocuments)
    .values({
      tenantId,
      uploadedBy,
      domainId: input.domainId,
      title: input.title,
      contentText: input.contentText,
      fileName: input.fileName,
      fileType: input.fileType,
      processingStatus: "PROCESSED",
    })
    .returning();
  return row;
}

export async function listDocumentsByDomain(
  db: Db,
  tenantId: string,
  domainId: string,
): Promise<DomainDocument[]> {
  return db
    .select()
    .from(domainDocuments)
    .where(
      and(
        eq(domainDocuments.tenantId, tenantId),
        eq(domainDocuments.domainId, domainId),
      ),
    );
}

export async function listProcessedDocumentsByDomain(
  db: Db,
  tenantId: string,
  domainId: string,
): Promise<DomainDocument[]> {
  return db
    .select()
    .from(domainDocuments)
    .where(
      and(
        eq(domainDocuments.tenantId, tenantId),
        eq(domainDocuments.domainId, domainId),
        eq(domainDocuments.processingStatus, "PROCESSED"),
      ),
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/queries-features.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Verify + commit**

Run: `npm test` (all green). Run: `npx tsc --noEmit` (exit 0).
```bash
git add lib/db/queries.ts tests/db/queries-features.test.ts
git commit -m "feat: add document + project/domain/story get/list queries"
```

---

### Task 2: Server-side authorization guard — TDD

**Files:**
- Modify: `lib/rbac.ts` (add `assertCan`)
- Create: `lib/auth/guard.ts` (server-only `requireProfile`, `requireCan`)
- Test: `tests/rbac-assert.test.ts`

**Interfaces:**
- Produces:
  - `rbac.ts`: `assertCan(role: Role, action: Action): void` — throws `Error("FORBIDDEN")` if not permitted.
  - `guard.ts`: `requireProfile(): Promise<UserProfile>` (redirects to `/login` if no session);
    `requireCan(action: Action): Promise<UserProfile>` (redirects if unauthenticated, throws `FORBIDDEN` if the role lacks the action).

- [ ] **Step 1: Write the failing test**

`tests/rbac-assert.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assertCan } from "@/lib/rbac";

describe("assertCan", () => {
  it("does not throw when the role is permitted", () => {
    expect(() => assertCan("TENANT_ADMIN", "create_domain")).not.toThrow();
    expect(() => assertCan("BA_PO", "create_story")).not.toThrow();
  });

  it("throws FORBIDDEN when the role is not permitted", () => {
    expect(() => assertCan("VIEWER", "create_story")).toThrow("FORBIDDEN");
    expect(() => assertCan("BA_PO", "create_domain")).toThrow("FORBIDDEN");
    expect(() => assertCan("PROJECT_MANAGER", "create_domain")).toThrow("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rbac-assert.test.ts`
Expected: FAIL — `assertCan` not exported.

- [ ] **Step 3: Implement**

Append to `lib/rbac.ts`:
```ts
// Server-side authorization assertion. Throws Error("FORBIDDEN") when the role
// may not perform the action. Call this in every mutation before writing.
export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error("FORBIDDEN");
  }
}
```

`lib/auth/guard.ts`:
```ts
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { assertCan, type Action } from "@/lib/rbac";
import type { UserProfile } from "@/lib/db/queries";

// Returns the current profile or redirects unauthenticated users to /login.
export async function requireProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

// Returns the current profile only if it may perform `action`; redirects if
// unauthenticated, throws FORBIDDEN if authenticated but not permitted.
export async function requireCan(action: Action): Promise<UserProfile> {
  const profile = await requireProfile();
  assertCan(profile.role, action);
  return profile;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rbac-assert.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

Run: `npm test` (green). Run: `npx tsc --noEmit` (exit 0).
```bash
git add lib/rbac.ts lib/auth/guard.ts tests/rbac-assert.test.ts
git commit -m "feat: add server-side authorization guard (assertCan, requireCan)"
```

---

### Task 3: Server actions + feature pages (glue)

**Files:**
- Create: `app/actions/features.ts` (createProjectAction, createDomainAction, createDocumentAction, createStoryAction)
- Create: `app/(app)/projects/page.tsx`
- Create: `app/(app)/projects/[projectId]/page.tsx`
- Create: `app/(app)/domains/page.tsx`
- Create: `app/(app)/domains/[domainId]/page.tsx`
- Create: `app/(app)/stories/new/page.tsx`
- Create: `app/(app)/stories/[storyId]/page.tsx`
- Create: `components/PermissionGate.tsx` (small helper to conditionally render create UI)

**Interfaces:**
- Consumes: `/lib/db/queries` (all), `/lib/auth/guard` (`requireProfile`, `requireCan`), `getDb`,
  `/lib/validation` (`projectInputSchema`, `domainInputSchema`, `documentInputSchema`,
  `storyInputSchema`), `/lib/rbac` (`can`).

This task is framework glue; verified by `tsc --noEmit`, `npm run build`, and the documented manual
smoke test. The permission and query logic it calls is covered by Tasks 1–2 and Plan 1/2.

- [ ] **Step 1: Server actions**

`app/actions/features.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  createProject,
  createDomain,
  createDocument,
  createStory,
} from "@/lib/db/queries";
import {
  projectInputSchema,
  domainInputSchema,
  documentInputSchema,
  storyInputSchema,
} from "@/lib/validation";

export async function createProjectAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_project");
  const parsed = projectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect("/projects?error=" + encodeURIComponent("A project name is required."));
  }
  await createProject(getDb(), profile.tenantId, profile.id, parsed.data);
  redirect("/projects");
}

export async function createDomainAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_domain");
  const parsed = domainInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect("/domains?error=" + encodeURIComponent("A domain name is required."));
  }
  await createDomain(getDb(), profile.tenantId, profile.id, parsed.data);
  redirect("/domains");
}

export async function createDocumentAction(formData: FormData): Promise<void> {
  const profile = await requireCan("upload_document");
  const domainId = String(formData.get("domainId") ?? "");
  const file = formData.get("file");
  let contentText = String(formData.get("contentText") ?? "");
  let fileName: string | undefined;
  let fileType: string | undefined;

  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".md")) {
      redirect(`/domains/${domainId}?error=` + encodeURIComponent("Only .txt or .md files are supported."));
    }
    contentText = await file.text();
    fileName = file.name;
    fileType = file.type || (name.endsWith(".md") ? "text/markdown" : "text/plain");
  }

  const parsed = documentInputSchema.safeParse({
    title: formData.get("title"),
    contentText,
    fileName,
    fileType,
  });
  if (!parsed.success) {
    redirect(`/domains/${domainId}?error=` + encodeURIComponent("A title and document text are required."));
  }
  await createDocument(getDb(), profile.tenantId, profile.id, {
    domainId,
    ...parsed.data,
  });
  redirect(`/domains/${domainId}`);
}

export async function createStoryAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_story");
  const parsed = storyInputSchema.safeParse({
    projectId: formData.get("projectId"),
    domainId: formData.get("domainId"),
    title: formData.get("title"),
    userRole: formData.get("userRole"),
    goal: formData.get("goal"),
    businessValue: formData.get("businessValue"),
    description: formData.get("description"),
    acceptanceCriteria: formData.get("acceptanceCriteria") || undefined,
    businessRules: formData.get("businessRules") || undefined,
    edgeCases: formData.get("edgeCases") || undefined,
  });
  if (!parsed.success) {
    redirect("/stories/new?error=" + encodeURIComponent("Please fill in all required fields."));
  }
  const story = await createStory(getDb(), profile.tenantId, profile.id, parsed.data);
  redirect(`/stories/${story.id}`);
}
```

- [ ] **Step 2: Permission gate helper**

`components/PermissionGate.tsx`:
```tsx
import { can, type Action, type Role } from "@/lib/rbac";

// Renders children only when the role may perform the action. Cosmetic only —
// the server action re-checks permission; this just hides UI the user can't use.
export function PermissionGate({
  role,
  action,
  children,
}: {
  role: Role;
  action: Action;
  children: React.ReactNode;
}) {
  if (!can(role, action)) return null;
  return <>{children}</>;
}
```

- [ ] **Step 3: Projects pages**

`app/(app)/projects/page.tsx`:
```tsx
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects } from "@/lib/db/queries";
import { createProjectAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const projects = await listProjects(getDb(), profile.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="create_project">
        <form action={createProjectAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="name" required placeholder="Project name" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="description" placeholder="Description (optional)" className="grow rounded-md border border-slate-300 px-3 py-2" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Create project</button>
        </form>
      </PermissionGate>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {projects.length === 0 && <li className="p-4 text-slate-500">No projects yet.</li>}
        {projects.map((p) => (
          <li key={p.id} className="p-4">
            <a href={`/projects/${p.id}`} className="font-medium text-brand hover:underline">{p.name}</a>
            {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`app/(app)/projects/[projectId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getProject, listStoriesByProject } from "@/lib/db/queries";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const profile = await requireProfile();
  const db = getDb();
  const project = await getProject(db, profile.tenantId, projectId);
  if (!project) notFound();
  const stories = await listStoriesByProject(db, profile.tenantId, projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.description && <p className="text-slate-600">{project.description}</p>}
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Stories</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {stories.length === 0 && <li className="p-4 text-slate-500">No stories in this project yet.</li>}
          {stories.map((s) => (
            <li key={s.id} className="p-4">
              <a href={`/stories/${s.id}`} className="font-medium text-brand hover:underline">{s.title}</a>
              <span className="ml-2 text-xs text-slate-500">{s.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Domains pages**

`app/(app)/domains/page.tsx`:
```tsx
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listDomains } from "@/lib/db/queries";
import { createDomainAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const domains = await listDomains(getDb(), profile.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Business Domains</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="create_domain">
        <form action={createDomainAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="name" required placeholder="Domain name (e.g. Payments)" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="description" placeholder="Description (optional)" className="grow rounded-md border border-slate-300 px-3 py-2" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Create domain</button>
        </form>
      </PermissionGate>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {domains.length === 0 && <li className="p-4 text-slate-500">No domains yet.</li>}
        {domains.map((d) => (
          <li key={d.id} className="p-4">
            <a href={`/domains/${d.id}`} className="font-medium text-brand hover:underline">{d.name}</a>
            {d.description && <p className="text-sm text-slate-600">{d.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`app/(app)/domains/[domainId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getDomain, listDocumentsByDomain } from "@/lib/db/queries";
import { createDocumentAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

export default async function DomainDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ domainId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { domainId } = await params;
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const domain = await getDomain(db, profile.tenantId, domainId);
  if (!domain) notFound();
  const docs = await listDocumentsByDomain(db, profile.tenantId, domainId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{domain.name}</h1>
        {domain.description && <p className="text-slate-600">{domain.description}</p>}
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="upload_document">
        <form action={createDocumentAction} encType="multipart/form-data" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="domainId" value={domainId} />
          <input name="title" required placeholder="Document title" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <textarea name="contentText" rows={4} placeholder="Paste reference text here..." className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <div className="text-sm text-slate-500">or upload a .txt / .md file:</div>
          <input type="file" name="file" accept=".txt,.md" className="text-sm" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Add document</button>
        </form>
      </PermissionGate>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Reference Documents</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {docs.length === 0 && <li className="p-4 text-slate-500">No documents yet. The AI review will use general agile criteria only.</li>}
          {docs.map((d) => (
            <li key={d.id} className="p-4">
              <div className="font-medium text-slate-900">{d.title}</div>
              <div className="text-xs text-slate-500">{d.processingStatus}{d.fileName ? ` · ${d.fileName}` : ""}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Story pages**

`app/(app)/stories/new/page.tsx`:
```tsx
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects, listDomains } from "@/lib/db/queries";
import { createStoryAction } from "@/app/actions/features";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const [projects, domains] = await Promise.all([
    listProjects(db, profile.tenantId),
    listDomains(db, profile.tenantId),
  ]);

  const field = "w-full rounded-md border border-slate-300 px-3 py-2";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New User Story</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {(projects.length === 0 || domains.length === 0) && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You need at least one project and one business domain first.
        </p>
      )}
      <form action={createStoryAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Project
            <select name="projectId" required className={field}>
              <option value="">Select…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Business Domain
            <select name="domainId" required className={field}>
              <option value="">Select…</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <input name="title" required placeholder="Story title" className={field} />
        <input name="userRole" required placeholder="User role (e.g. Retail banking customer)" className={field} />
        <textarea name="goal" required rows={2} placeholder="Goal — I want to…" className={field} />
        <textarea name="businessValue" required rows={2} placeholder="Business value — so that…" className={field} />
        <textarea name="description" required rows={3} placeholder="Description" className={field} />
        <textarea name="acceptanceCriteria" rows={3} placeholder="Acceptance criteria (optional)" className={field} />
        <textarea name="businessRules" rows={2} placeholder="Business rules (optional)" className={field} />
        <textarea name="edgeCases" rows={2} placeholder="Edge cases (optional)" className={field} />
        <button type="submit" className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark">Create story</button>
      </form>
    </div>
  );
}
```

`app/(app)/stories/[storyId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getStory } from "@/lib/db/queries";

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const profile = await requireProfile();
  const story = await getStory(getDb(), profile.tenantId, storyId);
  if (!story) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{story.title}</h1>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{story.status}</span>
      <dl className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <div><dt className="font-medium text-slate-500">As a</dt><dd>{story.userRole}</dd></div>
        <div><dt className="font-medium text-slate-500">I want</dt><dd>{story.goal}</dd></div>
        <div><dt className="font-medium text-slate-500">So that</dt><dd>{story.businessValue}</dd></div>
        <div><dt className="font-medium text-slate-500">Description</dt><dd className="whitespace-pre-wrap">{story.description}</dd></div>
        {story.acceptanceCriteria && <div><dt className="font-medium text-slate-500">Acceptance criteria</dt><dd className="whitespace-pre-wrap">{story.acceptanceCriteria}</dd></div>}
      </dl>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        AI review is added in Plan 4. The “Submit for AI review” action will appear here.
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck + build + tests**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run build` → succeeds; the new `/projects`, `/projects/[projectId]`, `/domains`,
`/domains/[domainId]`, `/stories/new`, `/stories/[storyId]` routes compile.
Run: `npm test` → all suites green.

- [ ] **Step 7: Commit**

```bash
git add "app/actions/features.ts" "app/(app)/projects" "app/(app)/domains" "app/(app)/stories" components/PermissionGate.tsx
git commit -m "feat: add projects, domains, documents, and story-creation pages"
```

---

## Manual Smoke Test (requires running Postgres + migrations)

1. Sign up (you are TENANT_ADMIN). Create a project and a business domain.
2. Open the domain, paste reference text (and/or upload a `.md`) → it appears in the documents list.
3. Go to New Story, pick the project + domain, fill required fields → redirected to the story detail.
4. Open the project → the story is listed under it.

---

## Plan 3 Self-Review

**Spec coverage:** project create/list/detail (§8/4.3) → Tasks 1,3; domain create/list/detail (§4.4)
→ Tasks 1,3; domain documents paste/upload `.txt`/`.md` (§4.5) → Tasks 1,3; story creation with
project+domain selection and mandatory-field validation (§4.6) → Tasks 1,3; server-side RBAC on every
mutation (§10/4.10) → Task 2 + actions; tenant scoping on every read/write → Task 1 queries. ✓

**Placeholder scan:** no TBD/TODO; the story-detail "AI review in Plan 4" note is an intentional,
labelled forward reference, not an unfinished requirement for this plan. ✓

**Type consistency:** query function signatures (Task 1) match action call sites (Task 3);
`assertCan`/`requireCan` (Task 2) consumed by every action; `profile.role` (pgEnum union) is
assignable to rbac `Role`. ✓

**Deferred to Plan 4:** the AI review pipeline (`/lib/ai`, prompt builder, `/api/reviews`), the
story-workspace review UI, and the real dashboard KPIs/charts. **Plan 5:** CI + Hostinger deploy docs.
