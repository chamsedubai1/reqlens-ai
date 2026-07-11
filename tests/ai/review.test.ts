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
  const original = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  it("uses the mock provider and returns a validated review when no key is set", async () => {
    const review = await reviewStory(input);
    expect(() => validateAIReview(review)).not.toThrow();
    expect(review.overallScore).toBeGreaterThanOrEqual(0);
    expect(review.overallScore).toBeLessThanOrEqual(100);
  });
});
