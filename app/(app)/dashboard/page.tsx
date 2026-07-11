import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listStoriesByUser, listReviewsForKpi } from "@/lib/db/queries";
import {
  totalStories, averageFirstScore, averageFinalScore, aiDependencyIndex,
  readyOnFirstRate, qualityTrend, mostCommonWeakness, latestReviewPerStory,
} from "@/lib/kpi";

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const db = getDb();
  const [stories, kpiRows] = await Promise.all([
    listStoriesByUser(db, profile.tenantId, profile.id),
    listReviewsForKpi(db, profile.tenantId, profile.id),
  ]);
  const records = latestReviewPerStory(kpiRows);

  // Map storyId -> {first, final} from the freshest KPI row (kpiRows are createdAt desc,
  // so the first row seen per story is the latest review).
  const reviewByStory = new Map<string, { first: number; final: number }>();
  for (const r of kpiRows) {
    if (!reviewByStory.has(r.storyId)) {
      reviewByStory.set(r.storyId, { first: r.firstSubmissionScore, final: r.finalScore });
    }
  }

  const trend = qualityTrend(records);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile.fullName} 👋</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Total stories" value={String(totalStories(stories))} />
        <Card label="Avg first submission" value={String(averageFirstScore(records))} />
        <Card label="Avg final score" value={String(averageFinalScore(records))} />
        <Card label="AI Dependency Index" value={String(aiDependencyIndex(records))} hint="Lower is better over time" />
        <Card label="Ready on first" value={`${Math.round(readyOnFirstRate(records) * 100)}%`} />
        <Card label="Quality trend" value={trend} />
        <Card label="Most common weakness" value={mostCommonWeakness(records) ?? "—"} />
        <Card label="Reviewed stories" value={String(records.length)} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">My Stories</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Story</th><th className="p-3">Status</th>
                <th className="p-3">First</th><th className="p-3">Latest</th>
              </tr>
            </thead>
            <tbody>
              {stories.length === 0 && (
                <tr><td className="p-3 text-slate-500" colSpan={4}>No stories yet.</td></tr>
              )}
              {stories.map((s) => {
                const r = reviewByStory.get(s.id);
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="p-3"><a href={`/stories/${s.id}`} className="text-brand hover:underline">{s.title}</a></td>
                    <td className="p-3">{s.status}</td>
                    <td className="p-3">{r ? r.first : "—"}</td>
                    <td className="p-3">{r ? r.final : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
