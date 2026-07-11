import { describe, it, expect } from "vitest";
import { buildReviewInsert, dependencyLevel } from "@/lib/review/record";
import type { AIReview } from "@/lib/scoring";

const review: AIReview = {
  overallScore: 85,
  qualityLevel: "Good",
  readinessStatus: "Ready",
  scoreBreakdown: {
    roleClarity: 9, businessValue: 13, functionalClarity: 12,
    acceptanceCriteria: 17, investCompliance: 16, edgeCases: 8, testability: 10,
  },
  domainAlignmentScore: 88,
  strengths: ["a"], weaknesses: ["Edge Cases"], missingDomainRules: [], domainSpecificRisks: [],
  improvedUserStory: "As a...", improvedAcceptanceCriteria: ["ac"], suggestedBusinessRules: ["r"],
  suggestedEdgeCases: ["e"], referencedDocuments: ["Doc"], recommendation: "ok",
};

describe("dependencyLevel", () => {
  it("maps the improvement gap to a level", () => {
    expect(dependencyLevel(3)).toBe("Low");
    expect(dependencyLevel(12)).toBe("Medium");
    expect(dependencyLevel(25)).toBe("High");
  });
});

describe("buildReviewInsert", () => {
  it("uses the overall score as first + final on the first review", () => {
    const row = buildReviewInsert(review, null);
    expect(row.firstSubmissionScore).toBe(85);
    expect(row.finalScore).toBe(85);
    expect(row.improvementGap).toBe(0);
    expect(row.acceptanceCriteriaScore).toBe(17);
    expect(row.readinessStatus).toBe("Ready");
  });
  it("keeps the earlier first score and computes the gap on a re-review", () => {
    const row = buildReviewInsert(review, 65);
    expect(row.firstSubmissionScore).toBe(65);
    expect(row.finalScore).toBe(85);
    expect(row.improvementGap).toBe(20);
    expect(row.aiDependencyLevel).toBe("High");
  });
});
