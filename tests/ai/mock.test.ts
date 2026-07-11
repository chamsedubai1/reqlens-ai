import { describe, it, expect } from "vitest";
import { mockReview } from "@/lib/ai/mock";
import { validateAIReview } from "@/lib/scoring";
import type { ReviewInput } from "@/lib/ai/types";

const input: ReviewInput = {
  story: {
    title: "T",
    userRole: "customer",
    goal: "do things",
    businessValue: "value",
    description: "desc",
    acceptanceCriteria: "AC present",
    edgeCases: "an edge case",
  },
  domain: { name: "Payments", description: null },
  documents: [{ title: "Policy", contentText: "rule" }],
};

describe("mockReview", () => {
  it("returns a schema-valid AIReview", () => {
    const review = mockReview(input);
    expect(() => validateAIReview(review)).not.toThrow();
  });
  it("is deterministic for the same input", () => {
    expect(mockReview(input)).toEqual(mockReview(input));
  });
  it("scores higher when acceptance criteria and edge cases are present", () => {
    const withExtras = mockReview(input);
    const without = mockReview({
      ...input,
      story: { ...input.story, acceptanceCriteria: null, edgeCases: null },
    });
    expect(withExtras.overallScore).toBeGreaterThan(without.overallScore);
  });
  it("notes missing documents when none are provided", () => {
    const review = mockReview({ ...input, documents: [] });
    expect(review.missingDomainRules.join(" ").toLowerCase()).toContain("no domain reference");
  });
});
