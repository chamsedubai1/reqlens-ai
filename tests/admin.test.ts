import { describe, it, expect } from "vitest";
import { isLastAdminDemotion, isRole, ALL_ROLES } from "@/lib/admin";

const users = [
  { id: "a1", role: "TENANT_ADMIN" as const },
  { id: "b1", role: "BA_PO" as const },
];

describe("isLastAdminDemotion", () => {
  it("blocks demoting the only admin", () => {
    expect(isLastAdminDemotion(users, "a1", "VIEWER")).toBe(true);
  });
  it("allows demoting an admin when another admin remains", () => {
    const twoAdmins = [...users, { id: "a2", role: "TENANT_ADMIN" as const }];
    expect(isLastAdminDemotion(twoAdmins, "a1", "VIEWER")).toBe(false);
  });
  it("allows changing a non-admin's role", () => {
    expect(isLastAdminDemotion(users, "b1", "PROJECT_MANAGER")).toBe(false);
  });
  it("allows keeping an admin as admin", () => {
    expect(isLastAdminDemotion(users, "a1", "TENANT_ADMIN")).toBe(false);
  });
  it("returns false for an unknown user", () => {
    expect(isLastAdminDemotion(users, "nope", "VIEWER")).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts valid roles and rejects others", () => {
    for (const r of ALL_ROLES) expect(isRole(r)).toBe(true);
    expect(isRole("SUPERUSER")).toBe(false);
  });
});
