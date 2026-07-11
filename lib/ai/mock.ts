import type { ReviewInput } from "@/lib/ai/types";
import { readinessStatus, type AIReview } from "@/lib/scoring";

function filled(value?: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// Deterministic, schema-valid review. Scores scale with story completeness so the
// demo (and the dashboard) show meaningful variation without an OpenAI key.
export function mockReview(input: ReviewInput): AIReview {
  const s = input.story;
  const hasDocs = input.documents.length > 0;

  const scoreBreakdown = {
    roleClarity: filled(s.userRole) ? 9 : 4,
    businessValue: filled(s.businessValue) ? 13 : 6,
    functionalClarity: filled(s.description) ? 12 : 6,
    acceptanceCriteria: filled(s.acceptanceCriteria) ? 17 : 8,
    investCompliance: filled(s.goal) ? 16 : 9,
    edgeCases: filled(s.edgeCases) ? 8 : 3,
    testability: filled(s.acceptanceCriteria) ? 8 : 4,
  };
  const overallScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

  const weaknesses: string[] = [];
  if (!filled(s.acceptanceCriteria)) weaknesses.push("Acceptance Criteria");
  if (!filled(s.edgeCases)) weaknesses.push("Edge Cases");
  if (!filled(s.businessValue)) weaknesses.push("Business Value");

  return {
    overallScore,
    qualityLevel: overallScore >= 80 ? "Good" : "Needs work",
    readinessStatus: readinessStatus(overallScore),
    scoreBreakdown,
    domainAlignmentScore: hasDocs ? 88 : 60,
    strengths: [
      filled(s.userRole) ? "Clear user role" : "Has a stated goal",
      filled(s.businessValue) ? "Business value is articulated" : "Concise",
    ],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Minor wording improvements"],
    missingDomainRules: hasDocs
      ? []
      : ["No domain reference documents were provided; review used general agile criteria only."],
    domainSpecificRisks: hasDocs ? ["Verify limits against the referenced policy."] : [],
    improvedUserStory: `As a ${s.userRole}, I want to ${s.goal} so that ${s.businessValue}.`,
    improvedAcceptanceCriteria: [
      "Given a valid input, when the action is performed, then the expected outcome occurs.",
      "The system validates required fields and shows clear errors.",
    ],
    suggestedBusinessRules: hasDocs
      ? ["Apply the thresholds defined in the referenced documents."]
      : ["Define validation thresholds for the primary action."],
    suggestedEdgeCases: [
      "What happens on invalid or missing input?",
      "What happens when a limit is exceeded?",
    ],
    referencedDocuments: input.documents.map((d) => d.title),
    recommendation:
      overallScore >= 80
        ? "Ready with minor improvements."
        : "Needs improvement before sprint planning.",
  };
}
