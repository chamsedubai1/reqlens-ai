import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  readinessStatus,
  validateAIReview,
} from "@/lib/scoring";

const validReview = {
  overallScore: 82,
  qualityLevel: "Good",
  readinessStatus: "Ready",
  scoreBreakdown: {
    roleClarity: 8,
    businessValue: 13,
    functionalClarity: 12,
    acceptanceCriteria: 16,
    investCompliance: 17,
    edgeCases: 8,
    testability: 8,
  },
  domainAlignmentScore: 90,
  strengths: ["Clear role"],
  weaknesses: ["Few edge cases"],
  missingDomainRules: [],
  domainSpecificRisks: [],
  improvedUserStory: "As a user...",
  improvedAcceptanceCriteria: ["AC1"],
  suggestedBusinessRules: ["Rule 1"],
  suggestedEdgeCases: ["Edge 1"],
  referencedDocuments: ["Policy v1"],
  recommendation: "Ready with minor improvements",
};

describe("SCORE_WEIGHTS", () => {
  it("sums to 100", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe("readinessStatus", () => {
  it("maps score bands to statuses", () => {
    expect(readinessStatus(95)).toBe("Excellent");
    expect(readinessStatus(90)).toBe("Excellent");
    expect(readinessStatus(85)).toBe("Ready");
    expect(readinessStatus(80)).toBe("Ready");
    expect(readinessStatus(70)).toBe("Needs Improvement");
    expect(readinessStatus(65)).toBe("Needs Improvement");
    expect(readinessStatus(40)).toBe("Not Ready");
    expect(readinessStatus(0)).toBe("Not Ready");
  });
});

describe("validateAIReview", () => {
  it("accepts a well-formed review", () => {
    const parsed = validateAIReview(validReview);
    expect(parsed.overallScore).toBe(82);
    expect(parsed.scoreBreakdown.acceptanceCriteria).toBe(16);
  });

  it("throws when a required field is missing", () => {
    const bad = { ...validReview };
    // @ts-expect-error deliberately removing a required field
    delete bad.scoreBreakdown;
    expect(() => validateAIReview(bad)).toThrow();
  });

  it("throws when overallScore is out of range", () => {
    expect(() => validateAIReview({ ...validReview, overallScore: 150 })).toThrow();
  });
});
