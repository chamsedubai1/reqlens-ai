import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { UIMessageChunk } from "ai";
import {
  buildSystemPrompt,
  echoableContent,
  runCoachTurn,
  searchTool,
  sourcesAsToolResult,
  toAnthropicMessages,
  toSources,
  MAX_QUESTION_CHARS,
} from "@/lib/rag/coach";
import { citedIds, tokenizeCitations } from "@/lib/rag/citations";
import { createRateLimiter } from "@/lib/rag/rate-limit";
import type { RetrievedChunk } from "@/lib/rag/search";

const ui = (role: "user" | "assistant", text: string) => ({ role, parts: [{ type: "text", text }] });

const chunk = (title: string, pageStart: number, pageEnd = pageStart): RetrievedChunk => ({
  id: `${title}-${pageStart}`,
  source: `${title}.pdf`,
  title,
  pageStart,
  pageEnd,
  content: `Passage from ${title}.`,
  similarity: 0.8123,
});

describe("toAnthropicMessages", () => {
  it("forwards text turns, dropping tool parts, empty turns and leading assistant turns", () => {
    const out = toAnthropicMessages([
      ui("assistant", "Hi! Ask me anything."),
      ui("user", "What is INVEST?"),
      { role: "assistant", parts: [{ type: "dynamic-tool" }, { type: "text", text: "It is a checklist [S1]." }] },
      { role: "assistant", parts: [{ type: "step-start" }] },
      ui("user", "And the I?"),
    ]);
    expect(out).toEqual([
      { role: "user", content: "What is INVEST?" },
      { role: "assistant", content: "It is a checklist [S1]." },
      { role: "user", content: "And the I?" },
    ]);
  });

  it("rejects a conversation that doesn't end with a question, or an over-long question", () => {
    expect(toAnthropicMessages([ui("user", "Hi"), ui("assistant", "Hello")])).toHaveProperty("error");
    expect(toAnthropicMessages([ui("user", "x".repeat(MAX_QUESTION_CHARS + 1))])).toHaveProperty("error");
  });
});

describe("sources", () => {
  it("numbers sources from the given id and formats page ranges", () => {
    const sources = toSources([chunk("Guide", 4), chunk("Guide", 7, 8)], 3);
    expect(sources.map((s) => [s.id, s.pages, s.similarity])).toEqual([
      ["S3", "p. 4", 0.81],
      ["S4", "pp. 7–8", 0.81],
    ]);
    expect(sourcesAsToolResult({ query: "q", sources })).toContain("[S4] Guide, pp. 7–8\nPassage from Guide.");
  });

  it("tells the model plainly when nothing matched", () => {
    expect(sourcesAsToolResult({ query: "pizza", sources: [] })).toMatch(/No passages .* "pizza"/);
  });
});

describe("citations", () => {
  it("finds single and grouped markers", () => {
    expect([...citedIds("A [S1]. B [S2, S4]. C [S1].")]).toEqual(["S1", "S2", "S4"]);
    expect(tokenizeCitations("x [S2] y")).toEqual([
      { type: "text", value: "x " },
      { type: "cite", ids: ["S2"] },
      { type: "text", value: " y" },
    ]);
  });
});

describe("prompt and tool", () => {
  it("lists the library and requires citations and an honest 'not covered'", () => {
    const prompt = buildSystemPrompt([{ title: "Scrum Guide", source: "s.pdf", pages: 14 }]);
    expect(prompt).toContain("- Scrum Guide (14 pages)");
    expect(prompt).toMatch(/\[S2\]/);
    expect(prompt).toMatch(/don't cover/);
    expect(searchTool(6).input_schema.required).toEqual(["query"]);
  });
});

describe("echoableContent", () => {
  it("drops non-text blocks of a declined attempt before the last fallback marker", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "x" },
      { type: "text", text: "Partial" },
      { type: "tool_use", id: "old", name: "search_documents", input: {} },
      { type: "fallback" },
      { type: "tool_use", id: "new", name: "search_documents", input: { query: "q" } },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    const { echo, toolUses } = echoableContent(content);
    expect(echo.map((b) => b.type)).toEqual(["text", "tool_use"]);
    expect(toolUses.map((t) => t.id)).toEqual(["new"]);
  });
});

describe("createRateLimiter", () => {
  it("allows `limit` requests per window per key", () => {
    const limit = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limit("a", 0).ok).toBe(true);
    expect(limit("a", 10).ok).toBe(true);
    expect(limit("a", 20)).toEqual({ ok: false, retryAfterSec: 1 });
    expect(limit("b", 20).ok).toBe(true);
    expect(limit("a", 1000).ok).toBe(true);
  });
});

// A fake Anthropic client that replays scripted turns as stream events.
function fakeClient(turns: { content: Anthropic.Beta.BetaContentBlock[]; stop: string }[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(structuredClone(params));
          const turn = turns[calls.length - 1];
          const events: unknown[] = [];
          turn.content.forEach((block, index) => {
            if (block.type === "text") {
              events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
              events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
            } else {
              events.push({ type: "content_block_start", index, content_block: { ...block, input: {} } });
              if (block.type === "tool_use") {
                events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
              }
            }
            events.push({ type: "content_block_stop", index });
          });
          return {
            async *[Symbol.asyncIterator]() {
              yield* events;
            },
            finalMessage: async () => ({ content: turn.content, stop_reason: turn.stop }),
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe("runCoachTurn", () => {
  it("streams a search tool call, feeds results back, then streams the cited answer", async () => {
    const { client, calls } = fakeClient([
      {
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "tool_use", id: "tu_1", name: "search_documents", input: { query: "definition of ready" } },
        ] as unknown as Anthropic.Beta.BetaContentBlock[],
        stop: "tool_use",
      },
      {
        content: [{ type: "text", text: "A story is ready when… [S1]" }] as unknown as Anthropic.Beta.BetaContentBlock[],
        stop: "end_turn",
      },
    ]);
    const chunks: UIMessageChunk[] = [];
    const queries: string[] = [];

    await runCoachTurn({
      client,
      model: "claude-opus-5-5",
      system: "sys",
      tools: [searchTool(6)],
      messages: [{ role: "user", content: "When is a story ready?" }],
      search: async (q) => {
        queries.push(q);
        return [chunk("Guide", 5)];
      },
      writer: { write: (c) => chunks.push(c) },
    });

    expect(queries).toEqual(["definition of ready"]);
    expect(chunks.map((c) => c.type)).toEqual([
      "start",
      "start-step",
      "reasoning-start",
      "reasoning-end",
      "tool-input-start",
      "tool-input-delta",
      "tool-input-available",
      "tool-output-available",
      "finish-step",
      "start-step",
      "text-start",
      "text-delta",
      "text-end",
      "finish-step",
      "finish",
    ]);
    const output = chunks.find((c) => c.type === "tool-output-available") as { output: { sources: { id: string; pages: string }[] } };
    expect(output.output.sources).toMatchObject([{ id: "S1", pages: "p. 5" }]);

    // Second call carries the assistant turn (thinking included) and the tool result.
    const second = calls[1].messages as Anthropic.Beta.BetaMessageParam[];
    expect((second[1].content as { type: string }[]).map((b) => b.type)).toEqual(["thinking", "tool_use"]);
    expect(second[2].content).toMatchObject([{ type: "tool_result", tool_use_id: "tu_1" }]);
    expect(calls[0]).toMatchObject({
      fallbacks: "default",
      tool_choice: { type: "auto" },
      thinking: { type: "adaptive", display: "updates" },
      betas: ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"],
    });
  });

  it("answers directly without searching when the model doesn't call the tool", async () => {
    const { client } = fakeClient([
      { content: [{ type: "text", text: "Hi! Ask me about user stories." }] as unknown as Anthropic.Beta.BetaContentBlock[], stop: "end_turn" },
    ]);
    const chunks: UIMessageChunk[] = [];
    let searched = false;
    await runCoachTurn({
      client,
      model: "claude-haiku-5-5",
      system: "sys",
      tools: [searchTool(6)],
      messages: [{ role: "user", content: "hello" }],
      search: async () => {
        searched = true;
        return [];
      },
      writer: { write: (c) => chunks.push(c) },
    });
    expect(searched).toBe(false);
    expect(chunks.some((c) => c.type.startsWith("tool-"))).toBe(false);
  });

  it("forbids further tool calls on the last allowed model call", async () => {
    const search = { type: "tool_use", id: "t", name: "search_documents", input: { query: "q" } };
    const { client, calls } = fakeClient([
      ...Array.from({ length: 3 }, (_, i) => ({ content: [{ ...search, id: `t${i}` }] as unknown as Anthropic.Beta.BetaContentBlock[], stop: "tool_use" })),
      { content: [{ type: "text", text: "Done." }] as unknown as Anthropic.Beta.BetaContentBlock[], stop: "end_turn" },
    ]);
    await runCoachTurn({
      client,
      model: "claude-opus-5-5",
      system: "sys",
      tools: [searchTool(6)],
      messages: [{ role: "user", content: "q" }],
      search: async () => [],
      writer: { write: () => {} },
    });
    expect(calls).toHaveLength(4);
    expect(calls[3]).toMatchObject({ tool_choice: { type: "none" } });
  });
});
