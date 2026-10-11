// Evaluation harness for ReqLens Coach. Runs every question in eval/questions.json
// through the real Coach turn (or a deployed site with --url), grades the answer
// against its expectation, and writes a Markdown report plus full transcripts.
//
//   npm run rag:eval                          # in-process: same code path as /api/coach
//   npm run rag:eval -- --url https://reqlensai.com   # test the deployed app over HTTP
//   npm run rag:eval -- --only basics-05,hard-premise
//   npm run rag:eval -- --regrade             # re-score saved transcripts after a grader change
//
// Checks are deliberately simple and transparent (no LLM judge): did it search,
// did it cite the right document/chapter, does the text contain the required
// facts, does it admit "not covered" or "incomplete" when it should. Read the
// transcripts for the final word; a PASS is evidence, not proof.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getDocumentProxy, extractText } from "unpdf";
import { loadLocalEnv } from "./rag-env.mjs";

loadLocalEnv();

type Expect = {
  kind: "answer" | "not-covered" | "partial" | "correct-premise" | "no-search";
  chapters?: number[];
  source?: string;
  mustMatch?: string[];
  mustNotMatch?: string[];
  note?: string;
};
type Case = { id: string; category: string; turns: string[]; expect: Expect };
type Source = { id: string; title: string; source: string; pages: string; similarity: number };
type Turn = {
  question: string;
  text: string;
  notes: string;
  searches: { query: string; sources: Source[] }[];
  errors: string[];
  firstTokenMs: number | null;
  totalMs: number;
};

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    only: { type: "string" },
    out: { type: "string", default: "eval/results" },
    regrade: { type: "boolean", default: false },
  },
});

const NOTES_FILE = "user-stories-applied-study-notes.pdf";
const NOT_COVERED = /(don.?t|do not|doesn.?t|does not|didn.?t|did not)\s+(cover|include|contain|have|describe|mention|say|discuss|find)|not (covered|included|in (the|my|this) (library|documents?|notes))|no (passage|information|mention|details?)|couldn.?t find|could not find|nothing (in|about)|isn.?t (covered|in)|outside (the|my)/i;
const PARTIAL = /(incomplete|not (be )?(complete|exhaustive)|only (see|have|found|retriev|cover)|retrieved passages|can.?t (see|count|list)|cannot (see|count|list)|not (the|a) (whole|entire|full)|partial|may (have )?miss|might (have )?miss|not every|doesn.?t list|does not list|only (the )?topics|only lists|only returns|excerpts|exact counts?|can.?t give (you )?(an? )?(exact|complete|full)|cannot give (you )?(an? )?(exact|complete|full)|returned only (parts|some)|only (returned|found) (parts|some))/i;

const cases: Case[] = JSON.parse(readFileSync("eval/questions.json", "utf8"));
const selected = args.only ? cases.filter((c) => args.only!.split(",").includes(c.id)) : cases;

// Chapter -> page span of the study notes, read from the PDF's own headings.
async function chapterSpans(): Promise<Map<number, [number, number]>> {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path.join("data", NOTES_FILE))));
  const { text } = await extractText(pdf, { mergePages: false });
  const starts = new Map<number, number>();
  text.forEach((t, i) => {
    for (const m of t.matchAll(/Chapter (\d+)\. /g)) if (!starts.has(+m[1])) starts.set(+m[1], i + 1);
  });
  const spans = new Map<number, [number, number]>();
  for (const [ch, start] of starts) spans.set(ch, [start, Math.max(start, starts.get(ch + 1) ?? text.length)]);
  return spans;
}

const pageRange = (pages: string): [number, number] => {
  const m = pages.match(/(\d+)(?:–(\d+))?/)!;
  return [+m[1], +(m[2] ?? m[1])];
};

// Collects one turn from a stream of AI SDK UI message chunks.
function collector(question: string) {
  const started = Date.now();
  const turn: Turn = { question, text: "", notes: "", searches: [], errors: [], firstTokenMs: null, totalMs: 0 };
  const byCall = new Map<string, { query: string; sources: Source[] }>();
  return {
    turn,
    write(c: { type: string; [k: string]: unknown }) {
      if (c.type === "text-delta") {
        turn.firstTokenMs ??= Date.now() - started;
        turn.text += c.delta as string;
      } else if (c.type === "reasoning-delta") turn.notes += c.delta as string;
      else if (c.type === "tool-input-available") {
        const s = { query: (c.input as { query: string }).query, sources: [] as Source[] };
        byCall.set(c.toolCallId as string, s);
        turn.searches.push(s);
      } else if (c.type === "tool-output-available") {
        const s = byCall.get(c.toolCallId as string);
        if (s) s.sources = (c.output as { sources: Source[] }).sources;
      } else if (c.type === "error" || c.type === "tool-output-error") turn.errors.push(String(c.errorText));
      else if (c.type === "finish") turn.totalMs = Date.now() - started;
    },
  };
}

async function askHttp(base: string, messages: unknown[], question: string): Promise<Turn> {
  const col = collector(question);
  const res = await fetch(`${base.replace(/\/$/, "")}/api/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    col.turn.errors.push(`HTTP ${res.status}: ${await res.text()}`);
    return col.turn;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const data = buffer.slice(0, idx).replace(/^data: /, "");
      buffer = buffer.slice(idx + 2);
      if (data && data !== "[DONE]") col.write(JSON.parse(data));
    }
  }
  return col.turn;
}

let localTurn: ((messages: { role: "user" | "assistant"; parts: { type: string; text: string }[] }[], question: string) => Promise<Turn>) | undefined;
async function local() {
  if (localTurn) return localTurn;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const { getDb } = await import("@/lib/db/client");
  const { ragSettings } = await import("@/lib/rag/config");
  const { embedQuery } = await import("@/lib/rag/embed");
  const { listLibrary, searchChunks } = await import("@/lib/rag/search");
  const { buildSystemPrompt, runCoachTurn, searchTool, toAnthropicMessages } = await import("@/lib/rag/coach");
  const settings = ragSettings();
  const client = new Anthropic();
  const system = buildSystemPrompt(await listLibrary(getDb()));
  localTurn = async (messages, question) => {
    const col = collector(question);
    const converted = toAnthropicMessages(messages);
    if ("error" in converted) {
      col.turn.errors.push(converted.error);
      return col.turn;
    }
    try {
      await runCoachTurn({
        client,
        model: settings.model,
        system,
        tools: [searchTool(settings.topK)],
        messages: converted,
        search: async (q) => searchChunks(getDb(), q, await embedQuery(q), settings),
        writer: { write: (c) => col.write(c as { type: string }) },
      });
    } catch (err) {
      col.turn.errors.push(err instanceof Error ? err.message : String(err));
    }
    return col.turn;
  };
  return localTurn;
}

function grade(c: Case, turns: Turn[], spans: Map<number, [number, number]>) {
  const last = turns.at(-1)!;
  const e = c.expect;
  const failures: string[] = [];
  const searched = turns.some((t) => t.searches.length > 0);
  const all = last.searches.flatMap((s) => s.sources);
  const citedIds = new Set(last.text.match(/S\d+/g) ?? []);
  const cited = all.filter((s) => citedIds.has(s.id));

  if (turns.some((t) => t.errors.length)) failures.push(`error: ${turns.flatMap((t) => t.errors).join("; ")}`);
  if (!last.text) failures.push("empty answer");

  const inChapter = (s: Source) =>
    s.source === NOTES_FILE &&
    e.chapters!.some((ch) => {
      const span = spans.get(ch);
      const [a, b] = pageRange(s.pages);
      return span && b >= span[0] && a <= span[1];
    });

  if (e.kind === "no-search") {
    if (searched) failures.push("searched when it should not have");
  } else if (!searched) failures.push("did not search");

  if (e.kind === "answer" || e.kind === "correct-premise") {
    if (cited.length === 0) failures.push("no citations");
    if (e.chapters && !cited.some(inChapter)) {
      failures.push(all.some(inChapter) ? `right chapter retrieved but not cited (ch ${e.chapters.join("/")})` : `wrong chapter (expected ch ${e.chapters.join("/")})`);
    }
    if (e.source && !cited.some((s) => s.title.startsWith(e.source!))) failures.push(`did not cite ${e.source}`);
  }
  // Match against plain text: "**I**ndependent" must still count as "independent".
  const plain = last.text.replace(/[*_`]/g, "");
  if (e.kind === "not-covered" && !NOT_COVERED.test(plain)) failures.push("did not say the documents don't cover it");
  if (e.kind === "partial" && !PARTIAL.test(plain) && !NOT_COVERED.test(plain)) failures.push("did not acknowledge the answer is incomplete");
  for (const re of e.mustMatch ?? []) if (!new RegExp(re, "i").test(plain)) failures.push(`missing /${re}/`);
  for (const re of e.mustNotMatch ?? []) if (new RegExp(re, "i").test(plain)) failures.push(`contains forbidden /${re}/`);

  return {
    pass: failures.length === 0,
    failures,
    searches: turns.reduce((n, t) => n + t.searches.length, 0),
    cited: cited.map((s) => `${s.title.replace(/:.*| \(.*/, "")} ${s.pages}`),
  };
}

const spans = await chapterSpans();
const mode = args.regrade ? "regrade of saved transcripts" : args.url ? `HTTP ${args.url}` : "in-process";
console.log(`ReqLens Coach eval — ${selected.length} questions, ${mode}\n`);

// --regrade re-scores the saved transcripts (no API calls) after a grader fix.
const saved: { id: string; turns: Turn[] }[] = args.regrade
  ? JSON.parse(readFileSync(path.join(args.out!, "latest.json"), "utf8"))
  : [];

const results = [];
for (const c of selected) {
  const messages: { id: string; role: "user" | "assistant"; parts: { type: string; text: string }[] }[] = [];
  let turns: Turn[] = [];
  if (args.regrade) {
    turns = saved.find((s) => s.id === c.id)?.turns ?? [];
    if (turns.length === 0) continue;
  } else {
    for (const question of c.turns) {
      messages.push({ id: `u${messages.length}`, role: "user", parts: [{ type: "text", text: question }] });
      const turn = args.url ? await askHttp(args.url, messages, question) : await (await local())(messages, question);
      turns.push(turn);
      messages.push({ id: `a${messages.length}`, role: "assistant", parts: [{ type: "text", text: turn.text }] });
    }
  }
  const g = grade(c, turns, spans);
  results.push({ ...c, turns, grade: g });
  console.log(`${g.pass ? "PASS" : "FAIL"}  ${c.id.padEnd(22)} ${g.searches} search(es)  first token ${turns.at(-1)!.firstTokenMs ?? "-"}ms  ${g.failures.join("; ")}`);
}

const passed = results.filter((r) => r.grade.pass).length;
const byCategory = new Map<string, { pass: number; total: number }>();
for (const r of results) {
  const b = byCategory.get(r.category) ?? { pass: 0, total: 0 };
  b.total++;
  if (r.grade.pass) b.pass++;
  byCategory.set(r.category, b);
}
const ttft = results.map((r) => r.turns.at(-1)!.firstTokenMs).filter((x): x is number => x != null).sort((a, b) => a - b);
const median = ttft[Math.floor(ttft.length / 2)] ?? 0;

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const model = process.env.COACH_MODEL ?? "claude-haiku-5-5";
const md = [
  `# ReqLens Coach evaluation — ${stamp}`,
  "",
  `Mode: ${mode} · Model: ${args.url ? "(deployed)" : model} · **${passed}/${results.length} passed** · median first token ${median} ms`,
  "",
  "| Category | Passed |",
  "| --- | --- |",
  ...[...byCategory].map(([cat, b]) => `| ${cat} | ${b.pass}/${b.total} |`),
  "",
  "| ID | Question | Result | Searches | Cited | Notes |",
  "| --- | --- | --- | --- | --- | --- |",
  ...results.map((r) =>
    `| ${r.id} | ${r.turns.map((t) => t.question).join(" → ").replace(/\|/g, "\\|")} | ${r.grade.pass ? "✅" : "❌"} | ${r.grade.searches} | ${[...new Set(r.grade.cited)].join(", ") || "—"} | ${[...r.grade.failures, r.expect.note ?? ""].filter(Boolean).join("; ").replace(/\|/g, "\\|")} |`,
  ),
  "",
].join("\n");

mkdirSync(args.out!, { recursive: true });
writeFileSync(path.join(args.out!, "latest.md"), md);
writeFileSync(path.join(args.out!, "latest.json"), JSON.stringify(results, null, 2));
console.log(`\n${passed}/${results.length} passed · median first token ${median} ms`);
for (const [cat, b] of byCategory) console.log(`  ${cat}: ${b.pass}/${b.total}`);
console.log(`Report: ${path.join(args.out!, "latest.md")}`);
process.exit(0);
