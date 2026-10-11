// ReqLens Coach: identity of the indexed corpus and the retrieval knobs.
// Edit CORPUS when the documents in data/ change — it drives the page copy,
// the empty-state suggestions, and the system prompt's domain description.

export const CORPUS = {
  name: "ReqLens Coach",
  tagline: "Ask the playbook. Get answers with page-level sources.",
  // One sentence the model sees: what the documents are and who they serve.
  domain:
    "agile delivery for business analysts and product owners — writing, testing, estimating and planning user stories; Scrum's roles, events and artifacts; and other agile frameworks such as Kanban, Lean, XP, Hybrid and Bimodal",
  // Corpus-specific guidance appended to the system prompt.
  guidance:
    "The sources do not always agree. The 2020 Scrum Guide is the current, definitive definition of Scrum. The User Stories Applied study notes summarise a 2004 book and sometimes describe older Scrum practice (for example 30-day sprints, or the daily scrum's three questions). The Agile Methods study notes summarise the Scrum Guide and two secondary agile overviews (an AltexSoft whitepaper and the Agile Methodologies Guide 2025) and compare them in Part D. When sources differ, say so, attribute each view to its document, and treat the Scrum Guide as authoritative on Scrum's rules.",
  // Shown in the empty state so users know what the bot can and can't answer.
  description:
    "ReqLens Coach answers questions about user stories, Scrum and other agile frameworks from three reference documents: the 2020 Scrum Guide and two sets of study notes. Every answer cites the document and page it came from, and it tells you when they don't cover something.",
  suggestedQuestions: [
    "What does INVEST stand for?",
    "How do I split a story that is too big?",
    "Do partially finished stories count toward velocity?",
    "When should a team use Kanban instead of Scrum?",
    "Who is accountable for the Product Backlog?",
    "Does the Daily Scrum still use the three questions?",
  ],
} as const;

export function ragSettings() {
  return {
    // Passages returned per search. 8 × ~300 tokens keeps a search under ~2.5k
    // tokens of context; 6 cut off list-buried answers ranked 7th-9th (see eval).
    topK: Number(process.env.RAG_TOP_K ?? 8),
    // Cosine similarity floor; weaker matches are dropped so the model sees
    // "nothing relevant" instead of noise and can say it doesn't know.
    minSimilarity: Number(process.env.RAG_MIN_SIMILARITY ?? 0.6),
    // Haiku 5.5 streams its answer after a tool call; Opus 5.5 and Sonnet 5.5
    // currently return the post-search answer in one burst (measured; see README).
    model: process.env.COACH_MODEL ?? "claude-haiku-5-5",
  };
}
