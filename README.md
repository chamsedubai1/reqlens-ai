# ReqLens AI

Domain-Aware Requirements Intelligence — an AI quality gate for agile user stories.
ReqLens AI scores user stories, proposes improvements, and tracks whether a Business
Analyst's first-submission quality improves over time.

## Features

- Email/password auth with multi-tenant isolation; first signup provisions a tenant + admin.
- Projects, business domains, and reference documents (paste or `.txt`/`.md` upload).
- Domain-aware AI story review with a 7-category quality score, readiness status, and improvements.
- Pluggable AI reviewer — OpenAI or any OpenAI-compatible endpoint (e.g. self-hosted **Qwen** via Ollama/vLLM); a deterministic keyless mock runs when nothing is configured.
- Personal KPI dashboard: avg first/final score, AI Dependency Index, ready-on-first rate, quality trend.
- Role-based permissions (`TENANT_ADMIN`, `PROJECT_MANAGER`, `BA_PO`, `VIEWER`) enforced server-side.
- **ReqLens Coach** (`/coach`, public): a streaming RAG chat over the Scrum Guide and two sets of study notes (user stories; agile frameworks). Claude retrieves passages through a search tool call (hybrid vector + keyword search) and every answer shows page-level sources. See [ReqLens Coach](#reqlens-coach-rag-chat) below.

## Tech Stack

Next.js (App Router) · TypeScript · Tailwind CSS · self-hosted PostgreSQL (+ pgvector) · Drizzle ORM ·
custom auth (bcrypt + jose) · OpenAI-compatible AI (OpenAI / Qwen, optional) · Claude (Anthropic SDK) +
Vercel AI SDK for the Coach · Vitest · GitHub Actions · Hostinger (VPS).

## Local Development

1. `npm install`
2. Copy `.env.example` to `.env.local` and set values (see Environment below).
3. Start a local Postgres **with pgvector** (e.g. Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d pgvector/pgvector:pg16`).
4. Apply migrations: `npm run db:migrate`
5. (Optional) Seed demo data: `npm run db:seed`
6. (Optional, for the Coach) set `ANTHROPIC_API_KEY`, then `npm run rag:ingest` (first run downloads the ~35 MB embedding model)
7. `npm run dev` and open http://localhost:3000 (Coach: http://localhost:3000/coach)

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `SESSION_SECRET` | yes | >= 32 chars. `openssl rand -base64 48`. |
| `AI_BASE_URL` | no | OpenAI-compatible endpoint for a self-hosted model (e.g. Qwen). |
| `AI_MODEL` | no | Model name for that endpoint. |
| `AI_API_KEY` | no | Key for the endpoint, if it requires one. |
| `OPENAI_API_KEY` | no | Shortcut for using OpenAI directly. |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. |
| `ANTHROPIC_API_KEY` | Coach | Claude writes Coach answers. Server-only. |
| `RAG_MODEL_CACHE` | no | Where the local embedding model is cached. Defaults to `./.cache/models`. |
| `COACH_MODEL` | no | Defaults to `claude-haiku-5-5` (streams after tool calls; see "Model choice"). `claude-opus-5` also streams. |
| `RAG_TOP_K` / `RAG_MIN_SIMILARITY` | no | Passages per search (6) and cosine floor (0.6). |
| `COACH_RATE_LIMIT` / `COACH_PROXY_HOPS` | no | Questions per IP per 10 min (20); trusted proxies in front of the app (1, or 2 behind Traefik → nginx). |

### AI reviewer

The story reviewer talks to **any OpenAI-compatible `/v1/chat/completions` endpoint**, so you
can run an open model like **Qwen** instead of OpenAI. If none of the AI variables are set, the app
uses a **deterministic keyless mock** reviewer (great for demos/CI).

- **OpenAI:** set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`).
- **Qwen via Ollama:** `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=qwen2.5:14b`
  (run `ollama pull qwen2.5:14b`; `AI_API_KEY` not needed).
- **Qwen via vLLM:** `AI_BASE_URL=http://localhost:8000/v1`,
  `AI_MODEL=Qwen/Qwen2.5-14B-Instruct`, `AI_API_KEY=<your key if configured>`.
- **Alibaba DashScope:** `AI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`,
  `AI_MODEL=qwen-plus`, `AI_API_KEY=sk-...`.

The reviewer requests JSON mode, retries without it if the server rejects the param, and robustly
extracts the JSON object from the response (handles ```json fences that open models often add).

## Testing

`npm test` — Vitest unit + PGlite-backed integration tests (no external DB required).

## Scripts

`npm run dev|build|start|lint|typecheck|test|db:generate|db:migrate|db:seed|rag:ingest|rag:search|rag:eval`

## ReqLens Coach (RAG chat)

A public page at **`/coach`** where anyone can ask how to write, test, estimate and plan user
stories, how Scrum works, or how Kanban, Lean and XP compare, and get a streamed answer grounded in three reference documents,
with the document and page for every claim. It complements the story reviewer: the reviewer
grades *your* story; the Coach answers *how should I write it*.

**Live:** https://reqlensai.com/coach

### How it meets the brief

| Requirement | Where |
| --- | --- |
| Public deployment | Hostinger VPS (with the rest of ReqLens), not Vercel; see [deploy/HOSTINGER.md](deploy/HOSTINGER.md) §9 |
| Vercel AI SDK with streaming | Browser: `useChat` + `DefaultChatTransport` ([CoachChat.tsx](components/coach/CoachChat.tsx)). Server: `createUIMessageStream` / `createUIMessageStreamResponse` ([route.ts](app/api/coach/route.ts)). Claude is called through the official Anthropic SDK and its streaming events are written into the AI SDK UI message stream token by token ([coach.ts](lib/rag/coach.ts)). |
| RAG as a tool call | One tool, `search_documents(query)`; Claude decides when to call it ([coach.ts](lib/rag/coach.ts)) |
| Sources under answers | Cited passages first (title, pages, match %, expandable text, `[S2]` markers link to them); retrieved-but-uncited passages behind a toggle |
| Document set I control | Scrum Guide (CC BY-SA 4.0) + two sets of my own study notes |
| Empty state | What it has read, how it answers, six suggested questions |
| No client-side secrets | Keys are read only in the route; the built client bundle was scanned for keys, SDK and model code |

### How a question is answered

The browser posts the conversation to `/api/coach`, which streams one Claude turn
(`lib/rag/coach.ts`) as an AI SDK UI message stream:

1. Claude gets the question, a system prompt naming the indexed documents, and the
   `search_documents` tool. Retrieval is a **tool call**, not context stuffed into every
   prompt: Claude searches for substantive questions, skips greetings, thanks and off-topic
   requests, searches again with other wording when results are weak, and writes
   self-contained queries for follow-ups.
2. The tool runs **hybrid retrieval** (`lib/rag/search.ts`): semantic search (local
   `bge-small-en-v1.5` embeddings in pgvector, HNSW index) plus keyword search (Postgres
   full-text with BM25-style idf × term-frequency scoring), merged by reciprocal rank fusion.
   It returns up to 8 passages, labelled `S1`, `S2`, … with title and pages. A passage must
   clear a 0.6 similarity floor or match the query's keywords, so off-topic questions
   retrieve nothing and Claude says the documents don't cover it.
3. The answer streams token by token with inline `[S#]` citations. Claude is told to treat
   passages as data, correct false premises, attribute disagreements between the two
   documents, and say when a whole-document request (summaries, counts) can only be partial.

At most four model calls per question (three searches, then a forced answer), validated tool
input, and a per-IP rate limit (20 questions / 10 min) because the page is public.

### Corpus

`data/`: 3 documents, 67 pages, 151 chunks. All are documents I may publish, since passages are
shown verbatim to the public.

| Document | Pages | Why it's here | License |
| --- | --- | --- | --- |
| The Scrum Guide (2020), Schwaber & Sutherland | 14 | The definitive rules of Scrum | CC BY-SA 4.0 |
| User Stories Applied: Study Notes | 25 | INVEST, splitting, roles, acceptance tests, estimation, planning | My own chapter-by-chapter summary of Cohn (2004); short quotations attributed |
| Agile Methods: Study Notes | 28 | Kanban, Lean, XP, Hybrid, Bimodal, Design Thinking, scaling, tools; a comparison of how the sources describe Scrum | My own summary of the Scrum Guide (Part A, CC BY-SA), the AltexSoft whitepaper and the Agile Methodologies Guide 2025 |

The AltexSoft and European Scrum guides themselves were indexed during development and removed:
they are free downloads but copyrighted, so they are covered through my own summary instead.
The documents sometimes disagree (the 2004-era 30-day sprint and the daily scrum's "three
questions" vs the 2020 Scrum Guide; the whitepaper's seven-person team); the system prompt
makes the Scrum Guide authoritative on Scrum, asks Claude to attribute each view, and to cite
the Scrum Guide itself rather than a summary of it when both are retrieved.

### Chunking and retrieval decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Unit | Whole sentences packed to ~1,200 chars (~300 tokens) | About one section of the notes: one idea per passage, enough context to stand alone. Never cut mid-sentence. A 700-char variant scored the same on the eval (47/50 vs 47/50 before hybrid), so the larger, more readable passages were kept. |
| Overlap | Up to 200 chars of trailing sentences | An answer that straddles a boundary is still retrievable from one chunk. |
| Page breaks | Chunks may cross them; store `page_start`/`page_end` | Paragraphs continue across pages; citations stay exact (`pp. 7–8`). |
| Cleanup | Re-flow wrapped lines, repair hyphenation, keep bullets, drop repeated headers/footers and page numbers | Repeated headers would otherwise appear in every chunk and pull every embedding toward the same text. |
| Contents pages | Skipped (pages that are mostly numbered headings or dot leaders) | A list of every heading matches almost any query but answers none. |
| Metadata | `source` file, `title`, `chunk_index`, `page_start`, `page_end` | Enough for a precise, readable citation. |
| Embedding text | `title + chunk` | Gives short passages their document context. |
| Embeddings | `bge-small-en-v1.5`, local (Transformers.js, ~35 MB) | No third-party key or per-query cost. |
| Hybrid retrieval | Vector + keyword, reciprocal rank fusion | Embeddings missed a near-literal match buried in a list ("numbering story cards" vs "Do not number the cards"); keyword search finds it. Fixed the false-premise eval case. |
| top-K / floor | 8 / 0.6 cosine | 8 × ~300 tokens keeps a search under ~2.5k tokens. Raised from 6 after the eval showed list-buried answers ranked 7th–9th. Floor calibrated on 21 probe queries: on-topic best matches 0.69–0.87, off-topic ≤ 0.59. |

Tune with `npm run rag:ingest -- --dry-run --chunk-size 1000 --overlap 150` (chunk stats and
samples, no API calls) and `npm run rag:search -- "your question"` (ranked passages and scores).

### Model choice: Claude Haiku 5.5

Measured on the same post-search request: Opus 5.5 and Sonnet 5.5 returned the whole answer in
one burst after a tool call (text spread ≈ 0 s; first word ~7 s on Opus 5.5), while Haiku 5.5
and Opus 5 streamed it token by token. Haiku 5.5 was picked for real streaming, speed (median
first word ~2.9 s) and cost on a public page (~$0.001 per answer). Override with `COACH_MODEL`.

### Evaluation (stretch goal 1)

`npm run rag:eval` runs [eval/questions.json](eval/questions.json) through the same code path as
the API (or against a deployed site with `--url`), grades each answer and writes
[eval/results/latest.md](eval/results/latest.md) plus full transcripts. 55 questions:

- 30 questions with a known answer chapter: does the answer cite the study notes on a page in
  that chapter?
- Questions on the Agile Methods notes (Kanban metrics, Lean wastes, Bimodal, TDD, Kanban vs
  Scrum).
- Hard cases: content not in the notes (the 27 example stories, the foreword), outside the
  corpus (setting up Jira, PMBOK earned value), whole-document requests (summarise every chapter, count
  mentions), a false premise, a multi-step calculation, disagreeing sources, a follow-up, a
  question in French.
- Behaviour probes: greeting, thanks, off-topic, prompt injection (must not search).

**Latest: 52/55** (Haiku 5.5, hybrid retrieval, top-K 8; two consecutive runs both 52/55).
The only consistent failure is "who has the final say on priorities?", answered from the Scrum
Guide (Product Owner) without the notes' Ch. 9 line "the customer wins. Every time." The
others vary between runs: a correct answer citing the notes' responsibilities table instead of
chapters 1/7, and a Scrum timebox cited from the Agile Methods summary instead of the Scrum
Guide itself. A known weak spot is comparing the whitepaper's Scrum with the 2020 Guide: the
second half of that comparison table has no heading in its chunk, so it is rarely retrieved.
Checks are transparent regexes, not an LLM judge, so read the transcripts for the final word.

**Live site:** `npm run rag:eval -- --url https://reqlensai.com` on 10 of the questions: 9/10,
median first word 3.1 s, answers streamed through Traefik and nginx
([eval/results/live/latest.md](eval/results/live/latest.md)). The miss was the false premise:
the p. 9 passage was retrieved but overlooked.

### Hybrid retrieval (stretch goal 2)

See the table above: Postgres full-text search with BM25-style weighting fused with vector
search. Before it, the false-premise question ("Why does Cohn recommend numbering story
cards?") got a safe but uninformed "the documents don't say that"; with it, the bot finds
p. 9 and corrects the premise: "Cohn doesn't recommend numbering story cards. He advises
against it."

## Deployment (Hostinger VPS)

See "Hostinger Deployment" below.

## Project Structure

```
app/
  (public)/        Landing, /login, /signup
  (app)/            Protected routes: /dashboard, /projects, /projects/[projectId],
                     /stories/new, /stories/[storyId], /domains, /domains/[domainId]
  actions/          Server actions (auth, features, review)
  coach/            Public ReqLens Coach page
  api/coach/        Coach chat endpoint (streams a Claude turn with retrieval tool calls)
components/coach/   Coach chat UI, sources, citation-aware text rendering
data/               Coach corpus PDFs (+ optional titles.json)
lib/
  db/               Drizzle client, schema, queries
  auth/             Session handling, password hashing, current-user/guard helpers
  ai/               OpenAI-compatible provider (OpenAI/Qwen), mock reviewer, prompt builder, JSON parser
  review/           Review persistence
  rag/              Coach: chunking, embeddings, pgvector search, prompt/tool + streaming loop
  rbac.ts           Role-based permission checks
  scoring.ts        Story quality scoring model
  kpi.ts            BA improvement KPI calculations
  validation.ts     Input validation (Zod)
db/migrations/      SQL migrations (Drizzle Kit), applied by scripts/migrate.mjs
scripts/            migrate.mjs (db:migrate), seed.mjs (db:seed), rag-ingest / rag-search / rag-eval (Coach)
eval/               Coach evaluation questions and latest results
tests/              Vitest unit + PGlite integration tests
```

## Hostinger Deployment

These steps assume an Ubuntu VPS on Hostinger with root/sudo access.

1. **Provision the VPS.** Install Node 20, PostgreSQL 16, PM2, and nginx:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql postgresql-contrib nginx
   sudo npm install -g pm2
   ```
2. **Create the database and a DB user**, then set `DATABASE_URL` accordingly:
   ```bash
   sudo -u postgres psql -c "CREATE USER reqlens WITH PASSWORD 'change-me';"
   sudo -u postgres psql -c "CREATE DATABASE reqlens OWNER reqlens;"
   # DATABASE_URL=postgres://reqlens:change-me@localhost:5432/reqlens
   ```
3. **Clone the repo and install dependencies:**
   ```bash
   git clone <repo-url> reqlens-ai && cd reqlens-ai
   npm ci
   ```
   Set `DATABASE_URL`, `SESSION_SECRET`, and (optionally) `OPENAI_API_KEY` in the shell
   environment or a PM2 ecosystem file. Never commit these values.
4. **Build the app** (produces the standalone server in `.next/standalone`):
   ```bash
   npm run build
   ```
5. **Copy static assets into the standalone output** (the standalone build does not
   include `.next/static` or `public` by default):
   ```bash
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   ```
6. **Apply migrations:**
   ```bash
   npm run db:migrate
   ```
7. **Start the app with PM2** (listens on `PORT`, default `3000`):
   ```bash
   pm2 start .next/standalone/server.js --name reqlens
   ```
8. **Configure nginx** as a reverse proxy from port 80/443 to `127.0.0.1:3000`, and add
   TLS with Let's Encrypt (`certbot --nginx`).
9. **Persist across reboots:**
   ```bash
   pm2 save
   pm2 startup
   ```
