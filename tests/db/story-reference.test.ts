import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { createUserWithTenant, createProject, createDomain, createStory } from "@/lib/db/queries";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { if (close) await close(); close = undefined; });

async function seed(db: Awaited<ReturnType<typeof createTestDb>>["db"], name: string) {
  const t = await createUserWithTenant(db, { fullName: `A ${name}`, email: `a@${name}.test`, passwordHash: "h", tenantName: name });
  const project = await createProject(db, t.tenantId, t.userId, { name: "P" });
  const domain = await createDomain(db, t.tenantId, t.userId, { name: "D" });
  return { ...t, project, domain };
}
function storyInput(project: string, domain: string, title: string) {
  return { projectId: project, domainId: domain, title, userRole: "c", goal: "g", businessValue: "v", description: "d" };
}

describe("per-tenant story reference", () => {
  it("assigns 1, 2, 3 sequentially within a tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const s1 = await createStory(t.db, a.tenantId, a.userId, storyInput(a.project.id, a.domain.id, "one"));
    const s2 = await createStory(t.db, a.tenantId, a.userId, storyInput(a.project.id, a.domain.id, "two"));
    const s3 = await createStory(t.db, a.tenantId, a.userId, storyInput(a.project.id, a.domain.id, "three"));
    expect([s1.reference, s2.reference, s3.reference]).toEqual([1, 2, 3]);
  });

  it("keeps sequences independent per tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");
    const a1 = await createStory(t.db, a.tenantId, a.userId, storyInput(a.project.id, a.domain.id, "a1"));
    const b1 = await createStory(t.db, b.tenantId, b.userId, storyInput(b.project.id, b.domain.id, "b1"));
    const a2 = await createStory(t.db, a.tenantId, a.userId, storyInput(a.project.id, a.domain.id, "a2"));
    expect(a1.reference).toBe(1);
    expect(b1.reference).toBe(1); // independent tenant restarts at 1
    expect(a2.reference).toBe(2);
  });
});
