import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { RAG_EMBEDDING_DIMENSIONS, ragChunks } from "@/lib/db/schema";
import { fuseRankings, listLibrary, searchChunks, type RetrievedChunk } from "@/lib/rag/search";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  if (close) await close();
  close = undefined;
});

// Unit vector along one axis, so cosine similarity between axes is 0 and
// a blend of axes gives a predictable similarity.
function axis(...weights: [number, number][]): number[] {
  const v = new Array(RAG_EMBEDDING_DIMENSIONS).fill(0);
  for (const [i, w] of weights) v[i] = w;
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

describe("searchChunks (hybrid: pgvector + full-text on PGlite)", () => {
  async function seeded() {
    const t = await createTestDb();
    close = t.close;
    const row = (source: string, title: string, chunkIndex: number, page: number, content: string, embedding: number[]) => ({
      source, title, chunkIndex, pageStart: page, pageEnd: page, content, embedding,
    });
    await t.db.insert(ragChunks).values([
      row("a.pdf", "Guide A", 0, 1, "Velocity is the points completed in an iteration.", axis([0, 1])),
      row("a.pdf", "Guide A", 1, 3, "Story points are relative units of size.", axis([0, 1], [1, 1])),
      row("b.pdf", "Guide B", 0, 2, "Do not number the cards. Numbers add overhead.", axis([2, 1])),
    ]);
    return t.db;
  }

  it("ranks by cosine similarity and applies the floor to semantic-only hits", async () => {
    const db = await seeded();
    const results = await searchChunks(db, "iteration throughput", axis([0, 1]), { topK: 3, minSimilarity: 0.5 });
    expect(results.map((r) => [r.title, r.pageStart])).toEqual([
      ["Guide A", 1],
      ["Guide A", 3],
    ]);
    expect(results[0].similarity).toBeCloseTo(1, 5);
    expect(results[1].similarity).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("recovers a keyword match the embeddings miss", async () => {
    const db = await seeded();
    // Embedding points away from the "cards" chunk (similarity 0), but the words match.
    const results = await searchChunks(db, "numbering story cards", axis([0, 1]), { topK: 3, minSimilarity: 0.5 });
    expect(results.map((r) => r.content)).toContain("Do not number the cards. Numbers add overhead.");
  });

  it("returns nothing for an off-topic query with no keyword or semantic match", async () => {
    const db = await seeded();
    const results = await searchChunks(db, "sourdough bread recipe", axis([5, 1]), { topK: 3, minSimilarity: 0.5 });
    expect(results).toEqual([]);
  });

  it("lists the library", async () => {
    const db = await seeded();
    expect(await listLibrary(db)).toEqual([
      { source: "a.pdf", title: "Guide A", pages: 3, chunks: 2 },
      { source: "b.pdf", title: "Guide B", pages: 2, chunks: 1 },
    ]);
  });
});

describe("fuseRankings", () => {
  const c = (id: string, similarity: number): RetrievedChunk => ({
    id, similarity, source: "x.pdf", title: "X", pageStart: 1, pageEnd: 1, content: id,
  });

  it("boosts passages found by both retrievers and keeps keyword-only hits below the floor", () => {
    const fused = fuseRankings([c("a", 0.8), c("b", 0.7), c("low", 0.3)], [c("b", 0.7), c("kw", 0.2)], { topK: 5, minSimilarity: 0.6 });
    expect(fused.map((x) => x.id)).toEqual(["b", "a", "kw"]);
  });

  it("drops semantic-only hits below the floor and respects topK", () => {
    expect(fuseRankings([c("a", 0.5)], [], { topK: 5, minSimilarity: 0.6 })).toEqual([]);
    expect(fuseRankings([c("a", 0.9), c("b", 0.8), c("c", 0.7)], [], { topK: 2, minSimilarity: 0.6 }).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
