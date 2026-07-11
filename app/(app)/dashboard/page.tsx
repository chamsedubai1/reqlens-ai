import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listStoriesByUser, listReviewsForKpi } from "@/lib/db/queries";
import {
  totalStories, averageFirstScore, averageFinalScore, aiDependencyIndex,
  readyOnFirstRate, qualityTrend, mostCommonWeakness, latestReviewPerStory,
} from "@/lib/kpi";
import { clsx } from "@/lib/cx";
import {
  FileTextIcon, StarIcon, CheckCircleIcon, GaugeIcon, TargetIcon,
  TrendingUpIcon, BarChartIcon, PlusIcon,
} from "@/components/icons";

function KpiCard({
  Icon, tile, label, value, hint,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  tile: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", tile)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-50 text-emerald-700";
  if (score >= 65) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function StatusBadge({ status }: { status: string }) {
  const reviewed = status === "REVIEWED";
  return (
    <span className={clsx(
      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
      reviewed ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-600",
    )}>
      {status}
    </span>
  );
}

const TREND_TONE: Record<string, string> = {
  Improving: "text-emerald-600",
  Declining: "text-red-600",
  Stable: "text-slate-700",
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const db = getDb();
  const [stories, kpiRows] = await Promise.all([
    listStoriesByUser(db, profile.tenantId, profile.id),
    listReviewsForKpi(db, profile.tenantId, profile.id),
  ]);
  const records = latestReviewPerStory(kpiRows);

  // Freshest review per story (kpiRows are createdAt desc, so first seen = latest).
  const reviewByStory = new Map<string, { first: number; final: number }>();
  for (const r of kpiRows) {
    if (!reviewByStory.has(r.storyId)) {
      reviewByStory.set(r.storyId, { first: r.firstSubmissionScore, final: r.finalScore });
    }
  }

  const trend = qualityTrend(records);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Welcome back, {profile.fullName} 👋</h1>
          <p className="mt-1 text-slate-500">Here&apos;s your requirements-quality overview.</p>
        </div>
        <Link href="/stories/new" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-dark">
          <PlusIcon className="h-4 w-4" /> New Story
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard Icon={FileTextIcon} tile="bg-brand-100 text-brand" label="Total stories" value={String(totalStories(stories))} />
        <KpiCard Icon={StarIcon} tile="bg-violet-100 text-violet-600" label="Avg first submission" value={String(averageFirstScore(records))} />
        <KpiCard Icon={CheckCircleIcon} tile="bg-emerald-100 text-emerald-600" label="Avg final score" value={String(averageFinalScore(records))} />
        <KpiCard Icon={GaugeIcon} tile="bg-amber-100 text-amber-600" label="AI Dependency Index" value={String(aiDependencyIndex(records))} hint="Lower is better over time" />
        <KpiCard Icon={CheckCircleIcon} tile="bg-sky-100 text-sky-600" label="Ready on first" value={`${Math.round(readyOnFirstRate(records) * 100)}%`} />
        <KpiCard Icon={TrendingUpIcon} tile="bg-brand-100 text-brand" label="Quality trend" value={trend} />
        <KpiCard Icon={TargetIcon} tile="bg-rose-100 text-rose-600" label="Most common weakness" value={mostCommonWeakness(records) ?? "—"} />
        <KpiCard Icon={BarChartIcon} tile="bg-slate-100 text-slate-600" label="Reviewed stories" value={String(records.length)} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">My Stories</h2>
          {trend !== "Stable" && (
            <span className={clsx("text-sm font-medium", TREND_TONE[trend])}>Quality trend: {trend}</span>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Story</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">First</th>
                  <th className="px-5 py-3 font-semibold">Latest</th>
                </tr>
              </thead>
              <tbody>
                {stories.length === 0 && (
                  <tr><td className="px-5 py-6 text-slate-500" colSpan={4}>No stories yet. Create your first one.</td></tr>
                )}
                {stories.map((s) => {
                  const r = reviewByStory.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/stories/${s.id}`} className="font-medium text-brand hover:text-brand-dark">{s.title}</Link>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-3">
                        {r ? <span className={clsx("inline-flex rounded-md px-2 py-0.5 font-semibold", scoreTone(r.first))}>{r.first}</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r ? <span className={clsx("inline-flex rounded-md px-2 py-0.5 font-semibold", scoreTone(r.final))}>{r.final}</span> : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
