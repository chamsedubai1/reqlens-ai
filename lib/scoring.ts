import { z } from "zod";

// Canonical 7-category weighting (CLAUDE.md section 9). Sums to 100.
export const SCORE_WEIGHTS = {
  roleClarity: 10,
  businessValue: 15,
  functionalClarity: 15,
  acceptanceCriteria: 20,
  investCompliance: 20,
  edgeCases: 10,
  testability: 10,
} as const;

export type ReadinessStatus =
  | "Excellent"
  | "Ready"
  | "Needs Improvement"
  | "Not Ready";

export function readinessStatus(overallScore: number): ReadinessStatus {
  if (overallScore >= 90) return "Excellent";
  if (overallScore >= 80) return "Ready";
  if (overallScore >= 65) return "Needs Improvement";
  return "Not Ready";
}

const scoreBreakdownSchema = z.object({
  roleClarity: z.number().min(0).max(SCORE_WEIGHTS.roleClarity),
  businessValue: z.number().min(0).max(SCORE_WEIGHTS.businessValue),
  functionalClarity: z.number().min(0).max(SCORE_WEIGHTS.functionalClarity),
  acceptanceCriteria: z.number().min(0).max(SCORE_WEIGHTS.acceptanceCriteria),
  investCompliance: z.number().min(0).max(SCORE_WEIGHTS.investCompliance),
  edgeCases: z.number().min(0).max(SCORE_WEIGHTS.edgeCases),
  testability: z.number().min(0).max(SCORE_WEIGHTS.testability),
});

// Mirrors the required AI response contract (CLAUDE.md section 10).
export const aiReviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  qualityLevel: z.string(),
  readinessStatus: z.string(),
  scoreBreakdown: scoreBreakdownSchema,
  domainAlignmentScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingDomainRules: z.array(z.string()),
  domainSpecificRisks: z.array(z.string()),
  improvedUserStory: z.string(),
  improvedAcceptanceCriteria: z.array(z.string()),
  suggestedBusinessRules: z.array(z.string()),
  suggestedEdgeCases: z.array(z.string()),
  referencedDocuments: z.array(z.string()),
  recommendation: z.string(),
});

export type AIReview = z.infer<typeof aiReviewSchema>;

// Throws ZodError if the structure is invalid — callers must never persist an unvalidated review.
export function validateAIReview(data: unknown): AIReview {
  return aiReviewSchema.parse(data);
}
