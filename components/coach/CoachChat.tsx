"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type DynamicToolUIPart, type UIMessage } from "ai";
import { clsx } from "@/lib/cx";
import { citedIds } from "@/lib/rag/citations";
import type { CoachSource, SearchOutput } from "@/lib/rag/coach";
import { RichText } from "@/components/coach/RichText";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  FileTextIcon,
  MessageCircleIcon,
  RefreshIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  StopIcon,
} from "@/components/icons";

const MAX_CHARS = 2000;

export type CoachLibraryDoc = { title: string; pages: number };

export function CoachChat({
  name,
  description,
  suggestions,
  library,
}: {
  name: string;
  description: string;
  suggestions: readonly string[];
  library: CoachLibraryDoc[];
}) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/coach" }), []);
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } = useChat({ transport });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    clearError();
    void sendMessage({ text: q });
    setInput("");
  };

  // Shareable questions: /coach?q=What+does+INVEST+stand+for%3F asks on load.
  // The parameter is removed afterwards so a refresh doesn't ask again.
  const askedFromUrl = useRef(false);
  useEffect(() => {
    if (askedFromUrl.current) return;
    askedFromUrl.current = true;
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q")?.slice(0, MAX_CHARS);
    if (!q) return;
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search);
    ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState name={name} description={description} suggestions={suggestions} library={library} onAsk={ask} />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} message={m} />
                ) : (
                  <AssistantMessage key={m.id} message={m} pending={busy && i === messages.length - 1} />
                ),
              )}
              {status === "submitted" && messages.at(-1)?.role === "user" && <Thinking label="Reading your question…" />}
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{errorMessage(error)}</div>
              <button
                type="button"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
                className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900"
              >
                <RefreshIcon className="h-4 w-4" /> Retry
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/90 backdrop-blur">
        <form
          className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <label htmlFor="coach-input" className="sr-only">
              Ask {name} a question
            </label>
            <textarea
              id="coach-input"
              rows={1}
              value={input}
              maxLength={MAX_CHARS}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder="Ask about user stories, Scrum, Kanban…"
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                <StopIcon className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendIcon className="h-4 w-4" /> Ask
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>Answers come only from the indexed documents and can still be wrong — check the cited pages.</span>
            {messages.length > 0 && !busy && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  clearError();
                }}
                className="shrink-0 font-semibold text-slate-500 hover:text-slate-800"
              >
                New chat
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  name,
  description,
  suggestions,
  library,
  onAsk,
}: {
  name: string;
  description: string;
  suggestions: readonly string[];
  library: CoachLibraryDoc[];
  onAsk: (q: string) => void;
}) {
  const totalPages = library.reduce((n, d) => n + d.pages, 0);
  return (
    <div className="py-6 sm:py-10">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand">
          <MessageCircleIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">{name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">{description}</p>
      </div>

      <div className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Try asking</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand/40 hover:text-brand"
            >
              <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand" />
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BookOpenIcon className="h-5 w-5 text-brand" /> What it has read
          </div>
          {library.length ? (
            <>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                {library.map((d) => (
                  <li key={d.title} className="flex items-start gap-2">
                    <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {d.title} <span className="text-slate-400">· {d.pages} pp.</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-slate-400">
                {library.length} document{library.length === 1 ? "" : "s"}, {totalPages} pages
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No documents are indexed yet.</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircleIcon className="h-5 w-5 text-accent" /> How it answers
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Searches the documents when your question needs them.</li>
            <li>Cites the document and page for each claim — click a marker like <Marker id="S1" /> to see the passage.</li>
            <li>Tells you when the documents don’t cover something instead of guessing.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ message, pending }: { message: UIMessage; pending: boolean }) {
  const searches = message.parts.filter(
    (p): p is DynamicToolUIPart => p.type === "dynamic-tool" && p.toolName === "search_documents",
  );
  // Everything up to the last search is activity (progress notes, searches);
  // only text after it is the answer. A short remark the model makes between
  // searches ("Let me try other wording") must not be glued onto the answer.
  const lastSearch = message.parts.reduce((last, p, i) => (p.type === "dynamic-tool" ? i : last), -1);
  const activity: ({ kind: "search"; part: DynamicToolUIPart } | { kind: "note"; text: string; key: string })[] = [];
  message.parts.forEach((p, i) => {
    if (p.type === "dynamic-tool" && p.toolName === "search_documents") activity.push({ kind: "search", part: p });
    const note = p.type === "reasoning" || (p.type === "text" && i < lastSearch) ? p.text.trim() : "";
    if (note) activity.push({ kind: "note", text: note, key: `note-${i}` });
  });
  const text = message.parts
    .filter((p, i) => p.type === "text" && i > lastSearch)
    .map((p) => (p.type === "text" ? p.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
  const sources = searches.flatMap((s) =>
    s.state === "output-available" ? ((s.output as SearchOutput).sources ?? []) : [],
  );
  const cited = citedIds(text);
  const anchor = (id: string) => `${message.id}-${id}`;

  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand">
        <SparklesIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {activity.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {activity.map((a) =>
              a.kind === "search" ? (
                <SearchStatus key={a.part.toolCallId} part={a.part} />
              ) : (
                <p key={a.key} className="px-1 text-xs italic text-slate-500">{a.text}</p>
              ),
            )}
          </div>
        )}
        {text ? (
          <RichText text={text} onCite={(id) => document.getElementById(anchor(id))?.scrollIntoView({ behavior: "smooth", block: "center" })} knownIds={new Set(sources.map((s) => s.id))} />
        ) : pending && searches.every((s) => s.state === "output-available" || s.state === "output-error") ? (
          <Thinking label={searches.length ? "Reading the passages…" : "Thinking…"} />
        ) : null}
        {sources.length > 0 && <Sources sources={sources} cited={cited} anchor={anchor} />}
        {text && searches.length === 0 && !pending && (
          <div className="text-xs text-slate-400">Answered without searching the documents.</div>
        )}
      </div>
    </div>
  );
}

function SearchStatus({ part }: { part: DynamicToolUIPart }) {
  const query = (part.input as { query?: string } | undefined)?.query;
  const found = part.state === "output-available" ? (part.output as SearchOutput).sources.length : null;
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
      <SearchIcon className={clsx("h-3.5 w-3.5 shrink-0", found === null && part.state !== "output-error" && "animate-pulse")} />
      <span className="truncate">
        {part.state === "output-error"
          ? "Search failed"
          : found === null
            ? <>Searching{query ? <> for “{query}”</> : ""}…</>
            : <>Searched “{query}” · {found ? `${found} passage${found === 1 ? "" : "s"}` : "no relevant passages"}</>}
      </span>
    </div>
  );
}

function Sources({
  sources,
  cited,
  anchor,
}: {
  sources: CoachSource[];
  cited: Set<string>;
  anchor: (id: string) => string;
}) {
  const used = sources.filter((s) => cited.has(s.id));
  const other = sources.filter((s) => !cited.has(s.id));
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <BookOpenIcon className="h-4 w-4" /> Sources
      </div>
      {used.length > 0 ? (
        <div className="space-y-2">
          {used.map((s) => (
            <SourceCard key={s.id} source={s} id={anchor(s.id)} />
          ))}
        </div>
      ) : (
        <p className="px-1 text-sm text-slate-500">The answer didn’t cite any of the retrieved passages.</p>
      )}
      {other.length > 0 && (
        <details className="mt-2 px-1">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            {other.length} more passage{other.length === 1 ? "" : "s"} retrieved but not cited
          </summary>
          <div className="mt-2 space-y-2">
            {other.map((s) => (
              <SourceCard key={s.id} source={s} id={anchor(s.id)} muted />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SourceCard({ source, id, muted = false }: { source: CoachSource; id: string; muted?: boolean }) {
  return (
    <details id={id} className={clsx("group scroll-mt-24 rounded-xl border bg-white", muted ? "border-slate-100" : "border-slate-200")}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
        <Marker id={source.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">{source.title}</span>
          <span className="text-xs text-slate-500">
            {source.pages} · {Math.round(source.similarity * 100)}% match
          </span>
        </span>
        <span className="text-xs font-medium text-brand group-open:hidden">Show passage</span>
        <span className="hidden text-xs font-medium text-slate-500 group-open:inline">Hide</span>
      </summary>
      <blockquote className="mx-3 mb-3 whitespace-pre-line border-l-2 border-brand/30 pl-3 text-sm leading-relaxed text-slate-600">
        {source.excerpt}
      </blockquote>
    </details>
  );
}

export function Marker({ id }: { id: string }) {
  return (
    <span className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-md bg-brand-100 px-1 text-[11px] font-bold text-brand">
      {id}
    </span>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
      </span>
      {label}
    </div>
  );
}

function errorMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not a JSON error body
  }
  return error.message || "Something went wrong. Please try again.";
}
