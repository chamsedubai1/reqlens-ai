import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const SECRET = "test-secret-at-least-32-chars-long-xxxxx";

describe("session tokens", () => {
  it("round-trips a payload", async () => {
    const token = await createSessionToken({ userId: "user-123" }, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.userId).toBe("user-123");
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await createSessionToken({ userId: "user-123" }, SECRET);
    const payload = await verifySessionToken(token, "a-different-secret-value-32-chars-xx");
    expect(payload).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    expect(await verifySessionToken("not-a-jwt", SECRET)).toBeNull();
  });
});
