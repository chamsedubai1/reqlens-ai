import type { ReviewInput } from "@/lib/ai/types";
import { buildReviewPrompt } from "@/lib/ai/prompt";
import { extractJsonObject } from "@/lib/ai/parse";

// The reviewer talks to any OpenAI-compatible chat-completions endpoint. This
// covers OpenAI itself and self-hosted open models like Qwen served via Ollama,
// vLLM, or a DashScope-compatible gateway — just point AI_BASE_URL at the server.
export type AiConfig = { baseUrl: string; apiKey?: string; model: string };

export function aiConfig(): AiConfig {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return { baseUrl, apiKey, model };
}

// True when a real endpoint is configured (a custom base URL, or an API key).
// When false, the deterministic mock reviewer is used instead.
export function isLiveConfigured(): boolean {
  return Boolean(process.env.AI_BASE_URL || process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}

export async function providerReview(input: ReviewInput): Promise<unknown> {
  const { baseUrl, apiKey, model } = aiConfig();
  const { system, user } = buildReviewPrompt(input);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const base = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  const send = (jsonMode: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonMode ? { ...base, response_format: { type: "json_object" } } : base),
    });

  // Try native JSON mode first (OpenAI/vLLM support it); some servers reject the
  // param, so fall back to a plain request — the prompt already demands JSON.
  let res = await send(true);
  if (!res.ok) res = await send(false);
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no content");
  return extractJsonObject(content);
}
