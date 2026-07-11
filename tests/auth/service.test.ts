import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { registerUser, authenticateUser } from "@/lib/auth/service";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  if (close) await close();
  close = undefined;
});

const signup = {
  fullName: "Priya Sharma",
  tenantName: "Acme",
  email: "priya@acme.test",
  password: "longenough1",
};

describe("registerUser", () => {
  it("creates a tenant + TENANT_ADMIN and lets the user authenticate", async () => {
    const t = await createTestDb();
    close = t.close;
    const { userId, tenantId } = await registerUser(t.db, signup);
    expect(userId).toBeTruthy();
    expect(tenantId).toBeTruthy();

    const profile = await authenticateUser(t.db, signup.email, signup.password);
    expect(profile?.role).toBe("TENANT_ADMIN");
    expect(profile?.tenantId).toBe(tenantId);
  });

  it("rejects a duplicate email", async () => {
    const t = await createTestDb();
    close = t.close;
    await registerUser(t.db, signup);
    await expect(registerUser(t.db, signup)).rejects.toThrow("EMAIL_TAKEN");
  });
});

describe("authenticateUser", () => {
  it("returns null for a wrong password", async () => {
    const t = await createTestDb();
    close = t.close;
    await registerUser(t.db, signup);
    expect(await authenticateUser(t.db, signup.email, "wrongpass")).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const t = await createTestDb();
    close = t.close;
    expect(await authenticateUser(t.db, "nobody@x.test", "whatever")).toBeNull();
  });
});
