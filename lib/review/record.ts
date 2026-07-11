import type { AIReview } from "@/lib/scoring";

export type ReviewInsert = {
  firstSubmissionScore: number;
  finalScore: number;
  improvementGap: number;
  aiDependencyLevel: string;
  readinessStatus: string;
  roleClarityScore: number;
  businessValueScore: number;
  functionalClarityScore: number;
  acceptanceCriteriaScore: number;
  investScore: number;
  edgeCaseScore: number;
  testabilityScore: number;
  domainAlignmentScore: number;
  strengths: string[];
  weaknesses: string[];
  missingDomainRules: string[];
  domainSpecificRisks: string[];
  improvedUserStory: string;
  improvedAcceptanceCriteria: string[];
  suggestedBusinessRules: string[];
  suggestedEdgeCases: string[];
  referencedDocuments: string[];
  recommendation: string;
};

export function dependencyLevel(gap: number): "Low" | "Medium" | "High" {
  if (gap >= 20) return "High";
  if (gap >= 10) return "Medium";
  return "Low";
}

// Maps a validated AIReview to a story_reviews insert. On the first review the
// overall score is both first and final; on a re-review the earlier first score
// is preserved and the improvement gap is computed against it.
export function buildReviewInsert(
  review: AIReview,
  previousFirstScore: number | null,
): ReviewInsert {
  const firstSubmissionScore = previousFirstScore ?? review.overallScore;
  const finalScore = review.overallScore;
  const improvementGap = finalScore - firstSubmissionScore;
  const b = review.scoreBreakdown;
  return {
    firstSubmissionScore,
    finalScore,
    improvementGap,
    aiDependencyLevel: dependencyLevel(improvementGap),
    readinessStatus: review.readinessStatus,
    roleClarityScore: b.roleClarity,
    businessValueScore: b.businessValue,
    functionalClarityScore: b.functionalClarity,
    acceptanceCriteriaScore: b.acceptanceCriteria,
    investScore: b.investCompliance,
    edgeCaseScore: b.edgeCases,
    testabilityScore: b.testability,
    domainAlignmentScore: review.domainAlignmentScore,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    missingDomainRules: review.missingDomainRules,
    domainSpecificRisks: review.domainSpecificRisks,
    improvedUserStory: review.improvedUserStory,
    improvedAcceptanceCriteria: review.improvedAcceptanceCriteria,
    suggestedBusinessRules: review.suggestedBusinessRules,
    suggestedEdgeCases: review.suggestedEdgeCases,
    referencedDocuments: review.referencedDocuments,
    recommendation: review.recommendation,
  };
}
