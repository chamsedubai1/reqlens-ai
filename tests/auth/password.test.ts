import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("produces a hash different from the plaintext", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(hash).not.toBe("s3cret-password");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword("s3cret-password", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
