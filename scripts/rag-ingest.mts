// Indexes the PDFs in data/ into rag_chunks for ReqLens Coach.
//
//   npm run rag:ingest                 # (re)index every PDF in data/
//   npm run rag:ingest -- --dry-run    # chunk only: print stats + samples, no API calls
//   npm run rag:ingest -- --chunk-size 1000 --overlap 150
//
// Re-running is safe: each document's chunks are replaced in one transaction, and
// chunks of documents no longer in data/ are deleted.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { eq, notInArray } from "drizzle-orm";
import { getDocumentProxy, extractText } from "unpdf";
import { loadLocalEnv } from "./rag-env.mjs";

loadLocalEnv();

const { getDb } = await import("@/lib/db/client");
const { ragChunks } = await import("@/lib/db/schema");
const { chunkPages, DEFAULT_CHUNK_OPTIONS } = await import("@/lib/rag/chunk");
const { embedDocuments, EMBEDDING_MODEL } = await import("@/lib/rag/embed");

const { values: args } = parseArgs({
  options: {
    dir: { type: "string", default: "data" },
    "dry-run": { type: "boolean", default: false },
    "chunk-size": { type: "string" },
    overlap: { type: "string" },
  },
});

const dir = path.resolve(args.dir!);
const options = {
  chunkSize: Number(args["chunk-size"] ?? DEFAULT_CHUNK_OPTIONS.chunkSize),
  overlap: Number(args.overlap ?? DEFAULT_CHUNK_OPTIONS.overlap),
};

// Optional data/titles.json: { "file.pdf": "Display Title" } overrides PDF metadata.
const titlesFile = path.join(dir, "titles.json");
const titleOverrides: Record<string, string> = existsSync(titlesFile)
  ? JSON.parse(readFileSync(titlesFile, "utf8"))
  : {};

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
if (files.length === 0) {
  console.error(`No PDFs found in ${dir}. Put the corpus PDFs there and re-run.`);
  process.exit(1);
}

console.log(
  `Chunking ${files.length} PDF(s) from ${dir} — chunkSize=${options.chunkSize} overlap=${options.overlap}` +
    (args["dry-run"] ? " (dry run)" : ` — embeddings: ${EMBEDDING_MODEL}`),
);

const summary: { file: string; title: string; pages: number; chunks: number; avgChars: number }[] = [];

for (const file of files) {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path.join(dir, file))));
  const { text } = await extractText(pdf, { mergePages: false });
  const meta = (await pdf.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  const title = titleOverrides[file] ?? cleanTitle(meta?.Title) ?? humanise(file);

  const pages = text.map((t, i) => ({ page: i + 1, text: t }));
  const chunks = chunkPages(pages, options);
  const avgChars = Math.round(chunks.reduce((n, c) => n + c.content.length, 0) / Math.max(1, chunks.length));
  summary.push({ file, title, pages: pages.length, chunks: chunks.length, avgChars });

  const emptyPages = pages.filter((p) => p.text.trim().length < 20).length;
  if (emptyPages > pages.length / 2) {
    console.warn(`  ! ${file}: ${emptyPages}/${pages.length} pages have no text — scanned PDF? It needs OCR first.`);
  }

  if (args["dry-run"]) {
    for (const c of [chunks[0], chunks[Math.floor(chunks.length / 2)]].filter(Boolean)) {
      console.log(`\n  ── ${file} chunk #${c.index} (pp. ${c.pageStart}-${c.pageEnd}, ${c.content.length} chars)\n  ${c.content.slice(0, 400).replace(/\n/g, "\n  ")}…`);
    }
    continue;
  }

  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 96) {
    embeddings.push(...(await embedDocuments(chunks.slice(i, i + 96).map((c) => `${title}\n\n${c.content}`))));
  }

  await getDb().transaction(async (tx) => {
    await tx.delete(ragChunks).where(eq(ragChunks.source, file));
    for (let i = 0; i < chunks.length; i += 200) {
      await tx.insert(ragChunks).values(
        chunks.slice(i, i + 200).map((c, j) => ({
          source: file,
          title,
          chunkIndex: c.index,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          content: c.content,
          embedding: embeddings[i + j],
        })),
      );
    }
  });
  console.log(`  ✓ ${file}: ${chunks.length} chunks`);
}

if (!args["dry-run"]) {
  const removed = await getDb().delete(ragChunks).where(notInArray(ragChunks.source, files)).returning({ id: ragChunks.id });
  if (removed.length) console.log(`  Removed ${removed.length} chunks of documents no longer in ${dir}.`);
}

console.log("");
console.table(summary);
const total = summary.reduce((n, s) => n + s.chunks, 0);
console.log(`Total: ${summary.reduce((n, s) => n + s.pages, 0)} pages → ${total} chunks.`);
process.exit(0);

function cleanTitle(t?: string): string | undefined {
  const s = t?.trim();
  // Generic metadata titles ("Microsoft Word - draft3.docx", "Untitled") are worse than the file name.
  if (!s || s.length < 4 || /untitled|microsoft word|\.docx?$/i.test(s)) return undefined;
  return s;
}

function humanise(file: string): string {
  const base = file.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
