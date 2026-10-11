import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CoachChat, type CoachLibraryDoc } from "@/components/coach/CoachChat";
import { getDb } from "@/lib/db/client";
import { CORPUS } from "@/lib/rag/config";
import { listLibrary } from "@/lib/rag/search";

// Public page (not under the (app) auth group): anyone can try the Coach.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${CORPUS.name} · ReqLens AI`,
  description: CORPUS.description,
  openGraph: {
    title: `${CORPUS.name} — user stories, Scrum and agile, with sources`,
    description: CORPUS.description,
    type: "website",
    siteName: "ReqLens AI",
  },
  twitter: { card: "summary", title: CORPUS.name, description: CORPUS.description },
};

async function loadLibrary(): Promise<CoachLibraryDoc[]> {
  try {
    return (await listLibrary(getDb())).map(({ title, pages }) => ({ title, pages }));
  } catch (err) {
    console.error("[coach] could not list the library:", err instanceof Error ? err.message : err);
    return [];
  }
}

export default async function CoachPage() {
  const library = await loadLibrary();
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="ReqLens AI home">
              <Logo size="sm" />
            </Link>
            <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold text-accent-dark">Coach</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/login" className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="hidden rounded-lg bg-brand px-3 py-2 font-semibold text-white hover:bg-brand-dark sm:inline-block">
              Try ReqLens
            </Link>
          </nav>
        </div>
      </header>
      <CoachChat
        name={CORPUS.name}
        description={CORPUS.description}
        suggestions={CORPUS.suggestedQuestions}
        library={library}
      />
    </div>
  );
}
