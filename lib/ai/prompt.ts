import type { ReviewInput } from "@/lib/ai/types";
import { SCORE_WEIGHTS } from "@/lib/scoring";

const REQUIRED_JSON_SHAPE = `{
  "overallScore": 0, "qualityLevel": "", "readinessStatus": "",
  "scoreBreakdown": { "roleClarity": 0, "businessValue": 0, "functionalClarity": 0, "acceptanceCriteria": 0, "investCompliance": 0, "edgeCases": 0, "testability": 0 },
  "domainAlignmentScore": 0, "strengths": [], "weaknesses": [], "missingDomainRules": [], "domainSpecificRisks": [],
  "improvedUserStory": "", "improvedAcceptanceCriteria": [], "suggestedBusinessRules": [], "suggestedEdgeCases": [],
  "referencedDocuments": [], "recommendation": ""
}`;

export function buildReviewPrompt(input: ReviewInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are ReqLens AI, an expert agile Business Analyst that reviews user stories.",
    "Assess the story on agile quality, INVEST, testability, acceptance-criteria quality, and business-domain alignment.",
    "Use ONLY the provided reference documents for domain claims. Do not invent references or rules that are not supported by the documents.",
    "Clearly list any missing domain-specific rules.",
    "Respond with a single JSON object and nothing else — no markdown, no prose.",
    `The JSON must match exactly this shape: ${REQUIRED_JSON_SHAPE}`,
    `Category maximum scores: ${JSON.stringify(SCORE_WEIGHTS)} (they sum to 100 and equal overallScore).`,
  ].join("\n");

  const docs =
    input.documents.length > 0
      ? input.documents
          .map((d, i) => `Document ${i + 1} — ${d.title}:\n${d.contentText}`)
          .join("\n\n")
      : "No domain reference documents were provided. Base the review on general agile criteria only and set domainAlignmentScore conservatively.";

  const s = input.story;
  const user = [
    `Business domain: ${input.domain.name}${input.domain.description ? ` — ${input.domain.description}` : ""}`,
    "",
    "Reference documents:",
    docs,
    "",
    "User story to review:",
    `Title: ${s.title}`,
    `User role: ${s.userRole}`,
    `Goal: ${s.goal}`,
    `Business value: ${s.businessValue}`,
    `Description: ${s.description}`,
    `Acceptance criteria: ${s.acceptanceCriteria ?? "(none)"}`,
    `Business rules: ${s.businessRules ?? "(none)"}`,
    `Edge cases: ${s.edgeCases ?? "(none)"}`,
    "",
    `Score each category up to its maximum: ${JSON.stringify(SCORE_WEIGHTS)}, and return the JSON object.`,
  ].join("\n");

  return { system, user };
}
