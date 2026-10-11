// Inspect retrieval without the chat: shows what the Coach's search tool would
// return for a query. Use it to tune chunking, RAG_TOP_K and RAG_MIN_SIMILARITY.
//
//   npm run rag:search -- "how to write acceptance criteria"
//   npm run rag:search -- "definition of ready" --top-k 10
import { parseArgs } from "node:util";
import { loadLocalEnv } from "./rag-env.mjs";

loadLocalEnv();

const { getDb } = await import("@/lib/db/client");
const { embedQuery } = await import("@/lib/rag/embed");
const { searchChunks, formatPages } = await import("@/lib/rag/search");
const { ragSettings } = await import("@/lib/rag/config");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "top-k": { type: "string" } },
});
const query = positionals.join(" ").trim();
if (!query) {
  console.error('Usage: npm run rag:search -- "your question"');
  process.exit(1);
}

const settings = ragSettings();
const topK = Number(values["top-k"] ?? settings.topK);
// minSimilarity 0 here so you can see what the threshold would cut.
const results = await searchChunks(getDb(), query, await embedQuery(query), { topK, minSimilarity: 0 });

console.log(`\n"${query}" — top ${topK}, threshold ${settings.minSimilarity}\n`);
for (const [i, r] of results.entries()) {
  const kept = r.similarity >= settings.minSimilarity ? "  " : "✗ ";
  console.log(`${kept}${i + 1}. ${r.similarity.toFixed(3)}  ${r.title}, ${formatPages(r)}`);
  console.log(`     ${r.content.slice(0, 280).replace(/\s+/g, " ")}…\n`);
}
process.exit(0);
