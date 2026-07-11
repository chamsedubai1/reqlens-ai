import type { ReviewInput } from "@/lib/ai/types";
import { validateAIReview, type AIReview } from "@/lib/scoring";
import { mockReview } from "@/lib/ai/mock";
import { providerReview, isLiveConfigured } from "@/lib/ai/provider";

// Runs the review through the configured OpenAI-compatible endpoint (OpenAI, or
// a self-hosted open model like Qwen via Ollama/vLLM — set AI_BASE_URL/AI_MODEL).
// When nothing is configured, the deterministic mock reviewer is used. The result
// is always validated before being returned; an invalid structure throws
// (callers must not persist an invalid review).
// TODO: vector search — retrieve the most relevant document chunks here before
// building the prompt, instead of passing whole documents.
export async function reviewStory(input: ReviewInput): Promise<AIReview> {
  const raw = isLiveConfigured() ? await providerReview(input) : mockReview(input);
  return validateAIReview(raw);
}

export type { ReviewInput } from "@/lib/ai/types";
