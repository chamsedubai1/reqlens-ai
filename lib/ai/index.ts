import type { ReviewInput } from "@/lib/ai/types";
import { validateAIReview, type AIReview } from "@/lib/scoring";
import { mockReview } from "@/lib/ai/mock";
import { providerReview, isLiveConfigured } from "@/lib/ai/provider";

// Runs the review through the configured OpenAI-compatible endpoint (OpenAI, or
// a self-hosted open model like Qwen via Ollama/vLLM — set AI_BASE_URL/AI_MODEL).
// When nothing is configured, the deterministic mock reviewer is used. The result
// is always validated before being returned.
//
// If a live endpoint is configured but the call fails, times out, or returns an
// invalid structure, we fall back to the deterministic reviewer rather than failing
// the whole request. Self-hosted CPU models can be slow or flaky, and a story
// review should always return a usable result instead of a 504/hard error.
// TODO: vector search — retrieve the most relevant document chunks here before
// building the prompt, instead of passing whole documents.
export async function reviewStory(input: ReviewInput): Promise<AIReview> {
  if (!isLiveConfigured()) {
    return validateAIReview(mockReview(input));
  }
  try {
    return validateAIReview(await providerReview(input));
  } catch (err) {
    console.warn(
      "[reviewStory] live AI review failed — using the built-in reviewer instead:",
      err instanceof Error ? err.message : err,
    );
    return validateAIReview(mockReview(input));
  }
}

export type { ReviewInput } from "@/lib/ai/types";
