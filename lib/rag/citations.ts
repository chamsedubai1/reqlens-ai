// Citation markers in Coach answers look like [S2] or [S1, S3]. These helpers
// find them so the UI can link markers to source cards and list cited sources
// before merely-retrieved ones.

const MARKER = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

export type TextToken = { type: "text"; value: string } | { type: "cite"; ids: string[] };

export function tokenizeCitations(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    if (match.index > last) tokens.push({ type: "text", value: text.slice(last, match.index) });
    tokens.push({ type: "cite", ids: match[1].split(",").map((s) => s.trim()) });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function citedIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const t of tokenizeCitations(text)) if (t.type === "cite") t.ids.forEach((id) => ids.add(id));
  return ids;
}
