import Anthropic from "@anthropic-ai/sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { getDb } from "@/lib/db/client";
import { ragSettings } from "@/lib/rag/config";
import { embedQuery } from "@/lib/rag/embed";
import { listLibrary, searchChunks, type LibraryEntry } from "@/lib/rag/search";
import { createRateLimiter } from "@/lib/rag/rate-limit";
import {
  CoachRequestSchema,
  buildSystemPrompt,
  runCoachTurn,
  searchTool,
  toAnthropicMessages,
} from "@/lib/rag/coach";

// Public endpoint behind /coach (no login), so it is rate-limited per client IP.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const limiter = createRateLimiter({
  limit: Number(process.env.COACH_RATE_LIMIT ?? 20),
  windowMs: 10 * 60_000,
});

let anthropic: Anthropic | undefined;
let library: { at: number; docs: LibraryEntry[] } | undefined;

async function cachedLibrary(): Promise<LibraryEntry[]> {
  if (!library || Date.now() - library.at > 5 * 60_000) {
    library = { at: Date.now(), docs: await listLibrary(getDb()) };
  }
  return library.docs;
}

// The client is the X-Forwarded-For entry added by the outermost trusted proxy:
// the last entry behind nginx alone, the second-to-last behind Traefik → nginx
// (set COACH_PROXY_HOPS=2). Entries further left are client-controlled.
function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.COACH_PROXY_HOPS ?? 1));
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? req.headers.get("x-real-ip") ?? "unknown";
}

function jsonError(status: number, error: string, headers?: Record<string, string>) {
  return Response.json({ error }, { status, headers });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(503, "The Coach isn't configured on this server yet.");
  }

  const limit = limiter(clientIp(req));
  if (!limit.ok) {
    return jsonError(429, "You're asking faster than the Coach can answer. Please wait a few minutes.", {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  if (Number(req.headers.get("content-length") ?? 0) > 256_000) {
    return jsonError(413, "This conversation is too long. Start a new chat.");
  }
  const parsed = CoachRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid request.");
  const messages = toAnthropicMessages(parsed.data.messages);
  if ("error" in messages) return jsonError(400, messages.error);

  const settings = ragSettings();
  anthropic ??= new Anthropic();
  const docs = await cachedLibrary();

  const stream = createUIMessageStream({
    execute: ({ writer }) =>
      runCoachTurn({
        client: anthropic!,
        model: settings.model,
        system: buildSystemPrompt(docs),
        tools: [searchTool(settings.topK)],
        messages,
        search: async (query) =>
          searchChunks(getDb(), query, await embedQuery(query), {
            topK: settings.topK,
            minSimilarity: settings.minSimilarity,
          }),
        writer,
      }),
    onError: (err) => {
      console.error("[coach] turn failed:", err instanceof Error ? err.message : err);
      if (err instanceof Anthropic.RateLimitError) return "The Coach is busy right now. Please try again in a minute.";
      if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) {
        return "The AI service is temporarily unavailable. Please try again.";
      }
      return "Something went wrong while answering. Please try again.";
    },
  });

  // X-Accel-Buffering: nginx would otherwise buffer the SSE stream and the
  // answer would arrive all at once instead of streaming.
  return createUIMessageStreamResponse({ stream, headers: { "X-Accel-Buffering": "no" } });
}
