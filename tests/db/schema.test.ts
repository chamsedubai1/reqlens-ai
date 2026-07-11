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
