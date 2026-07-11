import { describe, it, expect } from "vitest";
import { storyInputSchema } from "@/lib/validation";

const validStory = {
  projectId: "11111111-1111-1111-1111-111111111111",
  domainId: "22222222-2222-2222-2222-222222222222",
  title: "Transfer money to a saved beneficiary",
  userRole: "Retail banking customer",
  goal: "transfer money to a saved beneficiary",
  businessValue: "so payments are fast and secure",
  description: "As a customer I want to transfer money...",
};

describe("storyInputSchema", () => {
  it("accepts a story with all mandatory fields", () => {
    const result = storyInputSchema.safeParse(validStory);
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = storyInputSchema.safeParse({ ...validStory, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only user role", () => {
    const result = storyInputSchema.safeParse({ ...validStory, userRole: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing goal", () => {
    const bad: Record<string, unknown> = { ...validStory };
    delete bad.goal;
    const result = storyInputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a missing business value", () => {
    const bad: Record<string, unknown> = { ...validStory };
    delete bad.businessValue;
    const result = storyInputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const result = storyInputSchema.safeParse(validStory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acceptanceCriteria).toBeUndefined();
    }
  });
});
