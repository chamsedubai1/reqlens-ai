"use client";

import { useState } from "react";
import Link from "next/link";
import { createStoryAction, createAndReviewStoryAction } from "@/app/actions/features";
import { STORY_TEMPLATES } from "@/lib/story-templates";
import { clsx } from "@/lib/cx";
import {
  InfoIcon, FolderIcon, LayersIcon, TargetIcon, UserIcon, FileTextIcon,
  CheckCircleIcon, ShieldCheckIcon, AlertTriangleIcon, BookOpenIcon,
  LightbulbIcon, SparklesIcon, ArrowLeftIcon,
} from "@/components/icons";

type Opt = { id: string; name: string };

const INVEST: [string, string][] = [
  ["Independent", "Stand-alone and not dependent on other stories"],
  ["Negotiable", "Open to discussion and refinement"],
  ["Valuable", "Delivers value to users or stakeholders"],
  ["Estimable", "Can be estimated for effort"],
  ["Small", "Small enough to be completed in a single sprint"],
  ["Testable", "Clear acceptance criteria for testing"],
];

const AI_TIPS = [
  "Be specific and clear in your description",
  "Include context about business rules",
  "Add acceptance criteria for testability",
  "Consider edge cases and exception scenarios",
];

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10";
const fieldWithIcon = field.replace("px-3.5", "pl-10 pr-3.5");

const initial = {
  projectId: "", domainId: "", title: "", userRole: "", goal: "", businessValue: "",
  description: "", acceptanceCriteria: "", businessRules: "", edgeCases: "",
};

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-slate-700">
      {children} {required && <span className="text-brand">*</span>}
    </span>
  );
}

export function NewStoryView({
  projects,
  domains,
  error,
}: {
  projects: Opt[];
  domains: Opt[];
  error?: string;
}) {
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const bind = (name: keyof typeof initial) => ({
    name,
    value: form[name] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value })),
  });
  const applyTemplate = (fields: Record<string, string>) => {
    setForm((f) => ({ ...f, ...fields }));
    setTemplatesOpen(false);
  };

  const missingSetup = projects.length === 0 || domains.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
              Create New User Story <SparklesIcon className="h-5 w-5 text-brand" />
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Capture the details of your user story for AI-powered review and improvement.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTemplatesOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-100"
        >
          <FileTextIcon className="h-4 w-4" /> Story Templates
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}
      {missingSetup && (
        <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least one <Link href="/projects" className="font-semibold underline">project</Link> and one{" "}
          <Link href="/domains" className="font-semibold underline">business domain</Link> first.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form action={createStoryAction} className="space-y-6 lg:col-span-2">
          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand"><InfoIcon className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-ink">Basic Information</h2>
                <p className="text-sm text-slate-500">Provide the essential details about this user story.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5 block">
                <Label required>Project</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><FolderIcon className="h-4 w-4" /></span>
                  <select required {...bind("projectId")} className={fieldWithIcon}>
                    <option value="" disabled>Select…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </label>
              <label className="space-y-1.5 block">
                <Label required>Business Domain</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><LayersIcon className="h-4 w-4" /></span>
                  <select required {...bind("domainId")} className={fieldWithIcon}>
                    <option value="" disabled>Select…</option>
                    {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </label>
            </div>

            <label className="mt-5 block space-y-1.5">
              <Label required>Story Title</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><TargetIcon className="h-4 w-4" /></span>
                <input required placeholder="e.g., Transfer money to a saved beneficiary" {...bind("title")} className={fieldWithIcon} />
              </div>
            </label>

            <label className="mt-5 block space-y-1.5">
              <Label required>User Role</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><UserIcon className="h-4 w-4" /></span>
                <input required placeholder="e.g., Retail banking customer" {...bind("userRole")} className={fieldWithIcon} />
              </div>
              <span className="text-xs text-slate-400">Who is the user of this story?</span>
            </label>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5 block">
                <Label required>Goal — I want to…</Label>
                <textarea required rows={3} placeholder="I want to…" {...bind("goal")} className={field} />
                <span className="text-xs text-slate-400">What does the user want to do?</span>
              </label>
              <label className="space-y-1.5 block">
                <Label required>Business Value — so that…</Label>
                <textarea required rows={3} placeholder="so that…" {...bind("businessValue")} className={field} />
                <span className="text-xs text-slate-400">Why is this important? What value does it deliver?</span>
              </label>
            </div>
          </section>

          {/* Story Details */}
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><FileTextIcon className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-ink">Story Details</h2>
                <p className="text-sm text-slate-500">Add more context and specific details about the story.</p>
              </div>
            </div>

            <label className="block space-y-1.5">
              <Label required>Description</Label>
              <textarea required rows={3} placeholder="Provide a clear and concise description of what needs to be built…" {...bind("description")} className={field} />
            </label>

            <label className="mt-5 block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircleIcon className="h-4 w-4 text-emerald-500" /> Acceptance Criteria <span className="font-normal text-slate-400">(Optional)</span></span>
              <textarea rows={3} placeholder="List the conditions that must be met for this story to be complete…" {...bind("acceptanceCriteria")} className={field} />
            </label>

            <label className="mt-5 block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheckIcon className="h-4 w-4 text-brand" /> Business Rules <span className="font-normal text-slate-400">(Optional)</span></span>
              <textarea rows={2} placeholder="List the business rules that apply to this story…" {...bind("businessRules")} className={field} />
            </label>

            <label className="mt-5 block space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><AlertTriangleIcon className="h-4 w-4 text-amber-500" /> Edge Cases <span className="font-normal text-slate-400">(Optional)</span></span>
              <textarea rows={2} placeholder="Add any edge cases or special scenarios to consider…" {...bind("edgeCases")} className={field} />
            </label>
          </section>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</Link>
            <div className="flex gap-3">
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <FileTextIcon className="h-4 w-4" /> Save Draft
              </button>
              <button type="submit" formAction={createAndReviewStoryAction} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">
                <SparklesIcon className="h-4 w-4" /> Review with AI
              </button>
            </div>
          </div>
        </form>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><BookOpenIcon className="h-4 w-4" /></span>
              Writing Guide
            </div>
            <p className="mb-3 text-xs font-medium text-slate-500">A good user story is:</p>
            <ul className="space-y-3">
              {INVEST.map(([t, d]) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{t}</div>
                    <div className="text-xs text-slate-500">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500"><LightbulbIcon className="h-4 w-4" /></span>
              AI Tips
            </div>
            <p className="mb-2 text-xs font-medium text-slate-500">For better AI analysis:</p>
            <ul className="space-y-2">
              {AI_TIPS.map((t) => (
                <li key={t} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-brand/15 bg-brand-50/60 p-5">
            <div className="font-semibold text-brand">Need Inspiration?</div>
            <p className="mt-1 text-sm text-slate-600">Use our templates to get started quickly.</p>
            <button type="button" onClick={() => setTemplatesOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/20 bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50">
              <FileTextIcon className="h-4 w-4" /> View Templates
            </button>
          </div>
        </aside>
      </div>

      {/* Templates modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setTemplatesOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Story templates</h3>
              <button type="button" onClick={() => setTemplatesOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-3">
              {STORY_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.fields)}
                  className={clsx("flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand hover:bg-brand-50/50")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand"><FileTextIcon className="h-4 w-4" /></span>
                  <div>
                    <div className="font-semibold text-ink">{t.name}</div>
                    <div className="text-sm text-slate-500">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">Selecting a template fills the text fields; pick your project and domain above.</p>
          </div>
        </div>
      )}
    </div>
  );
}
