import type { ReviewInput } from "@/lib/ai/types";
import { validateAIReview, type AIReview } from "@/lib/scoring";
import { mockReview } from "@/lib/ai/mock";
import { openaiReview } from "@/lib/ai/openai";

// Runs the review through OpenAI when a key is configured, otherwise the
// deterministic mock. The result is always validated before being returned;
// an invalid structure throws (callers must not persist an invalid review).
// TODO: vector search — retrieve the most relevant document chunks here before
// building the prompt, instead of passing whole documents.
export async function reviewStory(input: ReviewInput): Promise<AIReview> {
  const raw = process.env.OPENAI_API_KEY
    ? await openaiReview(input)
    : mockReview(input);
  return validateAIReview(raw);
}

export type { ReviewInput } from "@/lib/ai/types";
