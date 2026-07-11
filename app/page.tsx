import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import {
  SparklesIcon,
  TargetIcon,
  BriefcaseIcon,
  BarChartIcon,
  FileTextIcon,
  ShieldCheckIcon,
  GaugeIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from "@/components/icons";

const FEATURES = [
  { Icon: TargetIcon, tile: "bg-brand-100 text-brand", title: "7-category quality score", body: "Role clarity, business value, INVEST, acceptance criteria, edge cases, testability — scored 0–100 with a readiness status." },
  { Icon: BriefcaseIcon, tile: "bg-accent-light text-accent-dark", title: "Domain-aware review", body: "Attach reference documents per business domain; the AI reviews stories against your real rules, not generic advice." },
  { Icon: GaugeIcon, tile: "bg-violet-100 text-violet-600", title: "AI Dependency Index", body: "Measure how much the AI improves each story — and watch that gap shrink as your first-draft quality rises." },
  { Icon: BarChartIcon, tile: "bg-amber-100 text-amber-600", title: "BA performance KPIs", body: "Avg first-submission score, ready-on-first rate, quality trend, and your most common weakness — at a glance." },
  { Icon: FileTextIcon, tile: "bg-sky-100 text-sky-600", title: "Improvements you can use", body: "Get an improved story, suggested acceptance criteria, business rules, and edge cases — ready to paste in." },
  { Icon: ShieldCheckIcon, tile: "bg-emerald-100 text-emerald-600", title: "Multi-tenant & secure", body: "Every workspace is isolated by tenant with role-based permissions enforced on the server." },
];

const STEPS = [
  { n: "1", title: "Add your domain", body: "Create a business domain and paste or upload reference documents." },
  { n: "2", title: "Write a story", body: "Capture the role, goal, value, and acceptance criteria in one form." },
  { n: "3", title: "Review & improve", body: "Submit for AI review, get a score and concrete improvements, track your trend." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-dark">
              Get started <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-mesh">
        <div className="pointer-events-none absolute right-8 top-24 h-72 w-72 rounded-full border border-brand/10" />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/70 px-4 py-1.5 text-sm font-semibold text-brand shadow-sm backdrop-blur">
            <SparklesIcon className="h-4 w-4" />
            Domain-Aware Requirements Intelligence
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
            An AI quality gate for your{" "}
            <span className="text-brand">agile user stories</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            ReqLens AI scores every story, proposes concrete improvements, and tracks whether your
            first-draft quality gets better over time — using your own business-domain context.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">
              Start free <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/login" className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Log in
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><CheckCircleIcon className="h-4 w-4 text-accent" /> Keyless demo mode</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircleIcon className="h-4 w-4 text-accent" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircleIcon className="h-4 w-4 text-accent" /> Multi-tenant &amp; secure</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">Everything a BA needs to ship sprint-ready stories</h2>
          <p className="mt-3 text-slate-600">From a raw idea to a testable, domain-aligned user story — with feedback you can act on.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, tile, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-card">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tile}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink">Three steps to better stories</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{s.n}</span>
                <h3 className="mt-5 font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-brand px-8 py-16 text-center text-white shadow-card">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Raise your first-submission quality</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-blue-100">Create a workspace and score your first story in a couple of minutes.</p>
          <div className="relative mt-8">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand shadow-lg hover:bg-blue-50">
              Get started free <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo size="sm" />
          <p className="text-sm text-slate-500">© 2026 ReqLens AI · Domain-Aware Requirements Intelligence</p>
        </div>
      </footer>
    </div>
  );
}
