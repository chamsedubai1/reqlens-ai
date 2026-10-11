import { asc, count, cosineDistance, desc, max, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { ragChunks } from "@/lib/db/schema";

export type RetrievedChunk = {
  id: string;
  source: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  similarity: number;
};

// How many candidates each retriever contributes before fusion.
const CANDIDATES = 20;
// Reciprocal-rank-fusion constant (the usual 60): damps the gap between rank 1 and 2.
const RRF_K = 60;

// Hybrid retrieval: semantic search (pgvector cosine over BGE embeddings) plus
// keyword search (Postgres full-text), merged with reciprocal rank fusion.
// Embeddings miss near-literal matches buried in list-heavy passages (e.g.
// "numbering story cards" vs "Do not number the cards"); keywords miss
// paraphrases. A passage is eligible if it clears the similarity floor OR
// matches the query's keywords, so off-topic questions still retrieve nothing.
export async function searchChunks(
  db: Db,
  query: string,
  queryEmbedding: number[],
  { topK, minSimilarity }: { topK: number; minSimilarity: number },
): Promise<RetrievedChunk[]> {
  const distance = cosineDistance(ragChunks.embedding, queryEmbedding);
  const columns = {
    id: ragChunks.id,
    source: ragChunks.source,
    title: ragChunks.title,
    pageStart: ragChunks.pageStart,
    pageEnd: ragChunks.pageEnd,
    content: ragChunks.content,
    similarity: sql<number>`1 - (${distance})`,
  };
  const weights = await termWeights(db, query);
  const terms = weights.map((w) => w.term);
  const idfs = weights.map((w) => w.idf);
  // Any-term match, scored BM25-style: for each query term, its idf times its
  // length-normalised frequency in the passage (ts_rank, normalisation 1). A rare
  // word like "number" outweighs words such as "story" that appear in most
  // passages, and a passage that repeats it ranks above one that mentions it once.
  const anyTerm = sql`to_tsquery('simple', ${terms.map((t) => `'${t.replace(/'/g, "''")}'`).join(" | ")})`;
  const termArray = sql`ARRAY[${sql.join(terms.map((t) => sql`${t}`), sql`, `)}]::text[]`;
  const idfArray = sql`ARRAY[${sql.join(idfs.map((w) => sql`${w}`), sql`, `)}]::float8[]`;
  const idfScore = sql<number>`(SELECT coalesce(sum(w.idf * ts_rank(${ragChunks.contentTsv}, to_tsquery('simple', quote_literal(w.term)), 1)), 0) FROM unnest(${termArray}, ${idfArray}) AS w(term, idf))`;

  const [semantic, keyword] = await Promise.all([
    db.select(columns).from(ragChunks).orderBy(asc(distance)).limit(CANDIDATES),
    terms.length === 0
      ? Promise.resolve([])
      : db
          .select(columns)
          .from(ragChunks)
          .where(sql`${ragChunks.contentTsv} @@ ${anyTerm}`)
          .orderBy(desc(idfScore))
          .limit(CANDIDATES),
  ]);

  const toChunk = (r: (typeof semantic)[number]) => ({ ...r, similarity: Number(r.similarity) });
  return fuseRankings(semantic.map(toChunk), keyword.map(toChunk), { topK, minSimilarity });
}

// The query's English lexemes with their BM25 idf over the indexed passages.
// Terms that appear in no passage are dropped (they cannot match anyway).
async function termWeights(db: Db, query: string): Promise<{ term: string; idf: number }[]> {
  const rows = await db.execute<{ term: string; df: string; n: string }>(sql`
    WITH q AS (SELECT DISTINCT unnest(tsvector_to_array(to_tsvector('english', ${query}))) AS term),
         n AS (SELECT count(*) AS n FROM ${ragChunks})
    SELECT q.term, s.ndoc AS df, n.n
    FROM q
    JOIN ts_stat(${`SELECT content_tsv FROM rag_chunks`}) s ON s.word = q.term
    CROSS JOIN n`);
  const list = Array.isArray(rows) ? rows : (rows as { rows: { term: string; df: string; n: string }[] }).rows;
  return list.map((r) => {
    const df = Number(r.df);
    const n = Number(r.n);
    return { term: r.term, idf: Math.log(1 + (n - df + 0.5) / (df + 0.5)) };
  });
}

export function fuseRankings(
  semantic: RetrievedChunk[],
  keyword: RetrievedChunk[],
  { topK, minSimilarity }: { topK: number; minSimilarity: number },
): RetrievedChunk[] {
  const scored = new Map<string, { chunk: RetrievedChunk; score: number; eligible: boolean }>();
  const add = (list: RetrievedChunk[], fromKeywords: boolean) =>
    list.forEach((chunk, rank) => {
      const entry = scored.get(chunk.id) ?? { chunk, score: 0, eligible: false };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.eligible ||= fromKeywords || chunk.similarity >= minSimilarity;
      scored.set(chunk.id, entry);
    });
  add(semantic, false);
  add(keyword, true);
  return [...scored.values()]
    .filter((e) => e.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((e) => e.chunk);
}

export function formatPages({ pageStart, pageEnd }: { pageStart: number; pageEnd: number }) {
  return pageStart === pageEnd ? `p. ${pageStart}` : `pp. ${pageStart}–${pageEnd}`;
}

export type LibraryEntry = { source: string; title: string; pages: number; chunks: number };

// What is indexed: one row per document, for the system prompt and the page.
export async function listLibrary(db: Db): Promise<LibraryEntry[]> {
  const rows = await db
    .select({
      source: ragChunks.source,
      title: ragChunks.title,
      pages: max(ragChunks.pageEnd),
      chunks: count(),
    })
    .from(ragChunks)
    .groupBy(ragChunks.source, ragChunks.title)
    .orderBy(asc(ragChunks.title));
  return rows.map((r) => ({ ...r, pages: Number(r.pages ?? 0), chunks: Number(r.chunks) }));
}
