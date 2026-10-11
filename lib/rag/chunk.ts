// Turns the per-page text of a PDF into overlapping, page-tagged chunks for the
// ReqLens Coach knowledge base. Pure functions — no I/O — so the chunking policy
// is unit-tested and the ingest script stays a thin wrapper.
//
// Policy (see README "ReqLens Coach" for the reasoning):
// - Chunks are packed from whole sentences, never cut mid-sentence, up to
//   `chunkSize` characters (~300 tokens at the default 1200). That is roughly one
//   guide section or a handful of paragraphs: small enough that a retrieved
//   passage is about one idea, big enough to carry its context.
// - Consecutive chunks share up to `overlap` characters of trailing sentences so
//   an answer that straddles a boundary is still retrievable from one chunk.
// - Chunks may cross a page break (a paragraph often does). Each chunk records
//   the first and last page its sentences came from, so citations stay exact.
// - Running headers/footers and page numbers repeated on many pages are removed
//   before chunking; otherwise they pollute every chunk and every embedding.
// - Table-of-contents pages are skipped: a list of every heading matches every
//   query but answers none.

export type PageText = { page: number; text: string };

export type Chunk = {
  index: number;
  pageStart: number;
  pageEnd: number;
  content: string;
};

export type ChunkOptions = { chunkSize: number; overlap: number; minChunkChars: number };

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 1200,
  overlap: 200,
  minChunkChars: 80,
};

const BULLET = /^([•●○■□▪◦‣\-*–]|\d{1,2}[.)]|[a-z][.)])\s+/;

// A table-of-contents page is mostly section headings ("2.1 What is Agile?") or
// dot-leader lines ("Sprint Review ........ 9"). Indexed, it would match almost
// any query while answering none, so such pages are skipped entirely.
const TOC_LINE = /(\.{4,}|…{2,})|^(\d+(\.\d+)*\.?)\s+\S.{0,90}$/;

export function isTableOfContents(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 8) return false;
  const tocLike = lines.filter((l) => TOC_LINE.test(l)).length;
  return tocLike / lines.length >= 0.6;
}

// Lines that repeat on a large share of pages (running titles, "Page 3 of 40",
// copyright footers). Digits are normalised so "Page 3" and "Page 4" match.
export function findRepeatedLines(pages: PageText[], minShare = 0.4): Set<string> {
  if (pages.length < 4) return new Set();
  const counts = new Map<string, number>();
  for (const { text } of pages) {
    const seen = new Set<string>();
    for (const raw of text.split("\n")) {
      const key = normaliseLine(raw);
      if (key && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * minShare));
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([k]) => k));
}

function normaliseLine(line: string): string {
  return line.trim().replace(/\d+/g, "#").replace(/\s+/g, " ").toLowerCase();
}

// Re-flows PDF line breaks into paragraphs: joins wrapped lines, repairs words
// hyphenated across lines, keeps bullet items on their own line, and treats a
// blank line as a paragraph break.
export function cleanPageText(text: string, repeated: Set<string> = new Set()): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .filter((l) => !repeated.has(normaliseLine(l)))
    .filter((l) => !/^\s*\d{1,4}\s*$/.test(l)); // bare page numbers

  const paragraphs: string[] = [];
  let current = "";
  const flush = () => {
    const p = current.replace(/[ \t]+/g, " ").trim();
    if (p) paragraphs.push(p);
    current = "";
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      current = line;
      continue;
    }
    if (!current) current = line;
    else if (/[A-Za-z]-$/.test(current)) current = current.slice(0, -1) + line;
    else current += " " + line;
  }
  flush();
  return paragraphs;
}

// Splits a paragraph into sentences; any sentence still longer than `max` is cut
// at word boundaries so no unit can exceed a chunk.
export function splitSentences(paragraph: string, max: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?:;])\s+(?=[A-Z0-9"“‘(•\-])/);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) {
      out.push(s);
      continue;
    }
    let piece = "";
    for (const word of s.split(" ")) {
      if (piece && piece.length + 1 + word.length > max) {
        out.push(piece);
        piece = word;
      } else {
        piece = piece ? `${piece} ${word}` : word;
      }
    }
    if (piece) out.push(piece);
  }
  return out;
}

type Unit = { text: string; page: number; paragraphStart: boolean };

export function chunkPages(
  pages: PageText[],
  options: Partial<ChunkOptions> = {},
): Chunk[] {
  const { chunkSize, overlap, minChunkChars } = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  if (overlap >= chunkSize) throw new Error("overlap must be smaller than chunkSize");

  const repeated = findRepeatedLines(pages);
  const units: Unit[] = [];
  for (const { page, text } of pages) {
    if (isTableOfContents(text)) continue;
    for (const paragraph of cleanPageText(text, repeated)) {
      splitSentences(paragraph, chunkSize).forEach((s, i) =>
        units.push({ text: s, page, paragraphStart: i === 0 }),
      );
    }
  }

  const render = (us: Unit[]) =>
    us
      .map((u, i) => (i === 0 ? u.text : (u.paragraphStart ? "\n\n" : " ") + u.text))
      .join("");

  const chunks: Chunk[] = [];
  let window: Unit[] = [];
  let fresh = 0; // units in `window` not already emitted in the previous chunk

  const emit = () => {
    if (fresh === 0) {
      // Only carried-over overlap is left and the next unit doesn't fit beside it:
      // drop the overlap rather than emit a duplicate chunk.
      window = [];
      return;
    }
    const content = render(window).trim();
    if (content.length >= minChunkChars) {
      chunks.push({
        index: chunks.length,
        pageStart: Math.min(...window.map((u) => u.page)),
        pageEnd: Math.max(...window.map((u) => u.page)),
        content,
      });
    }
    // Carry trailing sentences (up to `overlap` chars) into the next chunk.
    const carry: Unit[] = [];
    let carried = 0;
    for (let i = window.length - 1; i > 0; i--) {
      carried += window[i].text.length + 1;
      if (carried > overlap) break;
      carry.unshift(window[i]);
    }
    window = carry;
    fresh = 0;
  };

  for (const unit of units) {
    const projected = render([...window, unit]).length;
    if (window.length > 0 && projected > chunkSize) emit();
    window.push(unit);
    fresh++;
  }
  emit();
  return chunks;
}
