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
