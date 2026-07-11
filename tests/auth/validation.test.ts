import { describe, it, expect } from "vitest";
import { authSignupSchema, authLoginSchema } from "@/lib/validation";

describe("authSignupSchema", () => {
  const valid = {
    fullName: "Priya Sharma",
    tenantName: "Acme",
    email: "priya@acme.test",
    password: "longenough1",
  };
  it("accepts valid signup input", () => {
    expect(authSignupSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a short password", () => {
    expect(authSignupSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });
  it("rejects an invalid email", () => {
    expect(authSignupSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
  it("rejects an empty organization name", () => {
    expect(authSignupSchema.safeParse({ ...valid, tenantName: "" }).success).toBe(false);
  });
});

describe("authLoginSchema", () => {
  it("accepts valid login input", () => {
    expect(
      authLoginSchema.safeParse({ email: "a@b.test", password: "x" }).success,
    ).toBe(true);
  });
  it("rejects a missing password", () => {
    expect(authLoginSchema.safeParse({ email: "a@b.test" }).success).toBe(false);
  });
});
