import { Fragment, type ReactNode } from "react";
import { tokenizeCitations } from "@/lib/rag/citations";

// Renders the small Markdown subset the Coach is asked to use — paragraphs,
// bullet/numbered lists, **bold**, `code` — and turns [S2] markers into buttons
// that jump to the matching source card. Text only, never raw HTML.
export function RichText({
  text,
  onCite,
  knownIds,
}: {
  text: string;
  onCite: (id: string) => void;
  knownIds: Set<string>;
}) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const inline = (s: string) => renderInline(s, onCite, knownIds);
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
        ) : (
          <ul key={blocks.length} className="list-disc space-y-1 pl-5">{items}</ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line) {
      flushParagraph();
      flushList();
    } else if (list && raw.startsWith("  ")) {
      list.items[list.items.length - 1] += " " + line; // wrapped list item
    } else {
      flushList();
      paragraph.push(line.replace(/^#{1,6}\s+/, "")); // headings render as plain text
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-3 text-[15px] leading-relaxed text-slate-800">{blocks}</div>;
}

function renderInline(text: string, onCite: (id: string) => void, knownIds: Set<string>): ReactNode {
  return tokenizeCitations(text).map((token, i) => {
    if (token.type === "cite") {
      return (
        <Fragment key={i}>
          {token.ids.map((id) =>
            knownIds.has(id) ? (
              <button
                key={id}
                type="button"
                onClick={() => onCite(id)}
                title={`Show source ${id}`}
                className="mx-0.5 inline-flex h-5 items-center rounded-md bg-brand-100 px-1.5 align-text-top text-[11px] font-bold text-brand hover:bg-brand hover:text-white"
              >
                {id}
              </button>
            ) : (
              <span key={id} className="mx-0.5 text-[11px] font-semibold text-slate-400">[{id}]</span>
            ),
          )}
        </Fragment>
      );
    }
    return <Fragment key={i}>{emphasis(token.value)}</Fragment>;
  });
}

function emphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
