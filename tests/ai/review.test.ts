import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reviewStory } from "@/lib/ai/index";
import { validateAIReview } from "@/lib/scoring";
import type { ReviewInput } from "@/lib/ai/types";

const input: ReviewInput = {
  story: {
    title: "T",
    userRole: "customer",
    goal: "g",
    businessValue: "v",
    description: "d",
  },
  domain: { name: "Payments" },
  documents: [],
};

describe("reviewStory", () => {
  const LIVE_VARS = ["OPENAI_API_KEY", "AI_API_KEY", "AI_BASE_URL"] as const;
  const original: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const v of LIVE_VARS) {
      original[v] = process.env[v];
      delete process.env[v];
    }
  });
  afterEach(() => {
    for (const v of LIVE_VARS) {
      if (original[v] === undefined) delete process.env[v];
      else process.env[v] = original[v];
    }
  });

  it("uses the mock provider and returns a validated review when nothing is configured", async () => {
    const review = await reviewStory(input);
    expect(() => validateAIReview(review)).not.toThrow();
    expect(review.overallScore).toBeGreaterThanOrEqual(0);
    expect(review.overallScore).toBeLessThanOrEqual(100);
  });
});
