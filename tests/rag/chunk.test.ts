import { describe, it, expect } from "vitest";
import { chunkPages, cleanPageText, findRepeatedLines, isTableOfContents, splitSentences } from "@/lib/rag/chunk";

describe("isTableOfContents", () => {
  it("flags dot-leader and numbered-heading pages but not prose or short lists", () => {
    const dots = ["Purpose of the Scrum Guide..........1", "Scrum Definition ..........3", "Scrum Theory ........3", "Transparency .........3", "Inspection ........4", "Adaptation .........4", "Scrum Values ........4", "Scrum Team .........5"];
    const numbered = ["1. The Art of Project Management", "1.1 Project Management Phases", "2. Traditional Methodologies", "3. Agile Methodology", "4. Agile Frameworks", "5. Scrum: roles", "5.1 Sprints and artifacts", "Conclusion", "References"];
    const prose = Array.from({ length: 10 }, (_, i) => `This is ordinary sentence ${i} that wraps across a line of a page and keeps going.`);
    expect(isTableOfContents(dots.join("\n"))).toBe(true);
    expect(isTableOfContents(numbered.join("\n"))).toBe(true);
    expect(isTableOfContents(prose.join("\n"))).toBe(false);
    expect(isTableOfContents("1. One\n2. Two\n3. Three")).toBe(false);
  });
});

const sentence = (n: number) => `Sentence number ${n} explains one idea about user stories in plain words.`;

describe("cleanPageText", () => {
  it("re-flows wrapped lines, repairs hyphenation, and keeps bullets separate", () => {
    const text = "A user story describes a require-\nment from the\nuser's view.\n\n- First bullet\n● Second bullet\nwraps here\n";
    expect(cleanPageText(text)).toEqual([
      "A user story describes a requirement from the user's view.",
      "- First bullet",
      "● Second bullet wraps here",
    ]);
  });

  it("drops bare page numbers and repeated header lines", () => {
    const repeated = new Set(["the agile guide"]);
    expect(cleanPageText("The Agile Guide\nReal content here.\n12", repeated)).toEqual(["Real content here."]);
  });
});

describe("findRepeatedLines", () => {
  it("detects running headers and footers with changing page numbers", () => {
    const words = ["alpha", "bravo", "charlie", "delta", "echo"];
    const pages = [1, 2, 3, 4, 5].map((p) => ({ page: p, text: `Guide Title\nUnique line about ${words[p - 1]}\nPage ${p} of 5` }));
    const repeated = findRepeatedLines(pages);
    expect(repeated.has("guide title")).toBe(true);
    expect(repeated.has("page # of #")).toBe(true);
    expect([...repeated].some((l) => l.startsWith("unique"))).toBe(false);
  });

  it("does nothing for very short documents", () => {
    expect(findRepeatedLines([{ page: 1, text: "A" }, { page: 2, text: "A" }]).size).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on sentence boundaries and hard-wraps over-long sentences at words", () => {
    expect(splitSentences("One. Two! Three?", 100)).toEqual(["One.", "Two!", "Three?"]);
    const long = Array.from({ length: 50 }, () => "word").join(" ");
    const parts = splitSentences(long, 40);
    expect(parts.every((p) => p.length <= 40)).toBe(true);
    expect(parts.join(" ")).toBe(long);
  });
});

describe("chunkPages", () => {
  const pages = [1, 2, 3].map((page) => ({
    page,
    text: Array.from({ length: 8 }, (_, i) => sentence(page * 100 + i)).join(" "),
  }));

  it("keeps chunks within the size limit and never cuts a sentence", () => {
    const chunks = chunkPages(pages, { chunkSize: 300, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(300);
      expect(c.content.trim().endsWith(".")).toBe(true);
    }
  });

  it("records page ranges, including chunks that cross a page break", () => {
    const chunks = chunkPages(pages, { chunkSize: 300, overlap: 80 });
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks.at(-1)!.pageEnd).toBe(3);
    expect(chunks.some((c) => c.pageStart < c.pageEnd)).toBe(true);
    for (const c of chunks) {
      for (const n of c.content.match(/number (\d+)/g)!.map((m) => Number(m.split(" ")[1]))) {
        const page = Math.floor(n / 100);
        expect(page).toBeGreaterThanOrEqual(c.pageStart);
        expect(page).toBeLessThanOrEqual(c.pageEnd);
      }
    }
  });

  it("overlaps consecutive chunks by trailing sentences", () => {
    const chunks = chunkPages(pages, { chunkSize: 300, overlap: 80 });
    const lastSentence = chunks[0].content.split(/(?<=\.)\s+/).at(-1)!;
    expect(chunks[1].content.startsWith(lastSentence)).toBe(true);
  });

  it("covers every sentence and numbers chunks sequentially", () => {
    const chunks = chunkPages(pages, { chunkSize: 300, overlap: 0 });
    const all = chunks.map((c) => c.content).join(" ");
    for (const p of pages) for (const s of p.text.split(/(?<=\.)\s/)) expect(all).toContain(s.trim());
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("skips fragments below the minimum size and rejects overlap >= size", () => {
    expect(chunkPages([{ page: 1, text: "Tiny." }])).toEqual([]);
    expect(() => chunkPages(pages, { chunkSize: 100, overlap: 100 })).toThrow();
  });
});
