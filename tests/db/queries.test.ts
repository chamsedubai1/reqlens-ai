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
