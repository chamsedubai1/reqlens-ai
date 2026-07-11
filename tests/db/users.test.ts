import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant,
  listUsersByTenant,
  createUserInTenant,
  updateUserRole,
  getUserProfileByEmail,
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

describe("workspace user management", () => {
  it("lists only the caller tenant's users", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    await seed(t.db, "beta");

    await createUserInTenant(t.db, a.tenantId, {
      fullName: "BA One",
      email: "ba@alpha.test",
      passwordHash: "hash",
      role: "BA_PO",
    });

    const alphaUsers = await listUsersByTenant(t.db, a.tenantId);
    expect(alphaUsers).toHaveLength(2);
    expect(alphaUsers.map((u) => u.email).sort()).toEqual(["admin@alpha.test", "ba@alpha.test"]);
    expect(alphaUsers.some((u) => u.email === "admin@beta.test")).toBe(false);
  });

  it("creates a user in the tenant with the given role and lets them be found by email", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const { userId } = await createUserInTenant(t.db, a.tenantId, {
      fullName: "Viewer One",
      email: "viewer@alpha.test",
      passwordHash: "hash",
      role: "VIEWER",
    });
    expect(userId).toBeTruthy();
    const profile = await getUserProfileByEmail(t.db, "viewer@alpha.test");
    expect(profile?.role).toBe("VIEWER");
    expect(profile?.tenantId).toBe(a.tenantId);
  });

  it("updates a user's role, scoped by tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const { userId } = await createUserInTenant(t.db, a.tenantId, {
      fullName: "PM One",
      email: "pm@alpha.test",
      passwordHash: "hash",
      role: "BA_PO",
    });

    await updateUserRole(t.db, a.tenantId, userId, "PROJECT_MANAGER");
    const after = await getUserProfileByEmail(t.db, "pm@alpha.test");
    expect(after?.role).toBe("PROJECT_MANAGER");

    // A different tenant cannot change this user's role.
    const b = await seed(t.db, "beta");
    await updateUserRole(t.db, b.tenantId, userId, "VIEWER");
    const unchanged = await getUserProfileByEmail(t.db, "pm@alpha.test");
    expect(unchanged?.role).toBe("PROJECT_MANAGER");
  });
});
