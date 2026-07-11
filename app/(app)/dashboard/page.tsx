import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listReviewAnalytics } from "@/lib/db/queries";
import {
  latestAnalyticsPerStory, dashboardKpis, categoryQuality, scoreDistribution,
  byProject, trendSeries, weaknessHeatmap, insights,
} from "@/lib/analytics";
import { readinessStatus } from "@/lib/scoring";
import { Card, Badge, readinessTone } from "@/components/ui";
import { clsx } from "@/lib/cx";
import { Donut, LineTrend, Sparkline, GroupedBars, heatColor } from "@/components/charts";
import {
  SparklesIcon, FileTextIcon, StarIcon, CheckCircleIcon, GaugeIcon, TargetIcon,
  ShieldCheckIcon, TrendingUpIcon, LightbulbIcon,
} from "@/components/icons";

function Kpi({
  Icon, tile, label, value, hint, children,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  tile: string;
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", tile)}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
      {children}
    </Card>
  );
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={clsx("p-5", className)}>
      <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </Card>
  );
}

function scorePill(score: number) {
  const tone = score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 65 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={clsx("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", tone)}>{score}</span>;
}

const CAT_TONES = ["bg-brand-100 text-brand", "bg-amber-100 text-amber-600", "bg-sky-100 text-sky-600", "bg-violet-100 text-violet-600", "bg-emerald-100 text-emerald-600", "bg-rose-100 text-rose-600"];

export default async function DashboardPage() {
  const profile = await requireProfile();
  const rows = latestAnalyticsPerStory(await listReviewAnalytics(getDb(), profile.tenantId));

  const k = dashboardKpis(rows);
  const cats = categoryQuality(rows);
  const dist = scoreDistribution(rows);
  const projects = byProject(rows);
  const trend = trendSeries(rows);
  const heat = weaknessHeatmap(rows);
  const tips = insights(rows);
  const storiesTop = rows.slice(0, 10);

  const trendTone = k.trend === "Improving" ? "text-emerald-600" : k.trend === "Declining" ? "text-red-600" : "text-slate-600";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            Requirements Quality Dashboard <SparklesIcon className="h-5 w-5 text-brand" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">Track story quality, AI dependency, and readiness across your workspace.</p>
        </div>
        <Badge tone={k.trend === "Improving" ? "green" : k.trend === "Declining" ? "red" : "slate"}>
          Quality trend: {k.trend}{k.trend !== "Stable" ? ` (${k.trendDelta > 0 ? "+" : ""}${k.trendDelta})` : ""}
        </Badge>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand"><SparklesIcon className="h-6 w-6" /></div>
          <p className="mt-3 font-semibold text-ink">No reviewed stories yet</p>
          <p className="mt-1 text-sm text-slate-500">Create a story and run an AI review to populate your dashboard.</p>
          <Link href="/stories/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Create a story</Link>
        </Card>
      ) : (
        <>
          {/* KPI row 1 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            <Kpi Icon={FileTextIcon} tile="bg-brand-100 text-brand" label="Total Stories" value={String(k.total)} />
            <Kpi Icon={StarIcon} tile="bg-violet-100 text-violet-600" label="Avg First Score" value={String(k.avgFirst)} />
            <Kpi Icon={CheckCircleIcon} tile="bg-emerald-100 text-emerald-600" label="Avg Final Score" value={String(k.avgFinal)} />
            <Kpi Icon={GaugeIcon} tile="bg-amber-100 text-amber-600" label="AI Dependency" value={String(k.aiDependency)} hint="Lower is better" />
            <Kpi Icon={CheckCircleIcon} tile="bg-sky-100 text-sky-600" label="Ready on First" value={`${k.readyOnFirstPct}%`} />
            <Kpi Icon={TargetIcon} tile="bg-teal-100 text-teal-600" label="Sprint-Ready" value={`${k.sprintReadyPct}%`} />
            <Kpi Icon={ShieldCheckIcon} tile="bg-indigo-100 text-indigo-600" label="Domain Alignment" value={String(k.avgDomainAlignment)} />
            <Kpi Icon={TrendingUpIcon} tile="bg-brand-100 text-brand" label="Quality Trend" value={k.trend}>
              <div className="mt-1"><Sparkline values={trend.map((t) => t.score)} /></div>
            </Kpi>
          </div>

          {/* KPI row 2 — category quality */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cats.map((c, i) => (
              <Card key={c.key} className="p-4">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</span>
                  <span className={clsx("h-3 w-3 rounded-full", CAT_TONES[i % CAT_TONES.length])} />
                </div>
                <div className="mt-2 text-2xl font-bold text-ink">{c.pct}%</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                </div>
              </Card>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="First-Submission Score Trend" className="lg:col-span-2">
              <LineTrend points={trend} />
            </Panel>

            <Panel title="Score Distribution (Final Score)">
              <div className="flex items-center gap-4">
                <Donut segments={dist.map((d) => ({ value: d.count, color: d.color }))} />
                <ul className="space-y-1.5 text-sm">
                  {dist.map((d) => (
                    <li key={d.band} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-600">{d.band}</span>
                      <span className="ml-auto font-semibold text-slate-800">{d.count}</span>
                      <span className="text-xs text-slate-400">({d.pct}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel title="Quality Score by Project" className="lg:col-span-2">
              <div className="mb-2 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-300" /> First score</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand" /> Final score</span>
              </div>
              <GroupedBars data={projects.map((p) => ({ label: p.projectName, first: p.avgFirst, final: p.avgFinal }))} />
            </Panel>

            <Panel title="Top Performers (Final Score)">
              <ol className="space-y-3">
                {projects.slice(0, 5).map((p, i) => (
                  <li key={p.projectId} className="flex items-center gap-3">
                    <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
                    <span className="flex-1 truncate text-sm font-medium text-ink">{p.projectName}</span>
                    <span className="text-sm font-bold text-ink">{p.avgFinal}</span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Readiness by Project" className="lg:col-span-2">
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={p.projectId}>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{p.projectName}</span>
                      <span>{p.total} stories</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="bg-emerald-500" style={{ width: `${(p.ready / p.total) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(p.needs / p.total) * 100}%` }} />
                      <div className="bg-red-400" style={{ width: `${(p.notReady / p.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 pt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Ready</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-400" /> Needs Improvement</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-400" /> Not Ready</span>
                </div>
              </div>
            </Panel>

            <Panel title="AI Insights & Recommendations">
              <ul className="space-y-3">
                {tips.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600">
                    <LightbulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Top Weakness Heatmap" className="lg:col-span-3">
              <div className="overflow-x-auto">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr>
                      <th className="p-2" />
                      {heat.projects.map((p) => <th key={p} className="p-2 text-xs font-semibold text-slate-500">{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.categories.map((cat, ri) => (
                      <tr key={cat}>
                        <td className="p-2 text-left text-xs font-medium text-slate-600">{cat}</td>
                        {heat.cells[ri].map((v, ci) => (
                          <td key={ci} className="p-1">
                            <div className={clsx("rounded-lg py-2 text-xs font-semibold", heatColor(v))}>{v}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-end gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-100" /> High weakness</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-100" /> Moderate</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-100" /> Low</span>
                </div>
              </div>
            </Panel>
          </div>

          {/* Stories overview */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Stories Overview</h2>
              <span className="text-xs text-slate-400">Showing top {storiesTop.length} by latest review</span>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Story</th>
                      <th className="px-4 py-3 font-semibold">Project</th>
                      <th className="px-4 py-3 font-semibold">Domain</th>
                      <th className="px-4 py-3 font-semibold">First</th>
                      <th className="px-4 py-3 font-semibold">Latest</th>
                      <th className="px-4 py-3 font-semibold">Improvement</th>
                      <th className="px-4 py-3 font-semibold">Readiness</th>
                      <th className="px-4 py-3 font-semibold">Owner</th>
                      <th className="px-4 py-3 font-semibold">Last Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storiesTop.map((r) => {
                      const imp = r.finalScore - r.firstScore;
                      const status = readinessStatus(r.finalScore);
                      return (
                        <tr key={r.storyId} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-3"><Link href={`/stories/${r.storyId}`} className="font-medium text-brand hover:text-brand-dark">{r.storyTitle}</Link></td>
                          <td className="px-4 py-3 text-slate-600">{r.projectName}</td>
                          <td className="px-4 py-3 text-slate-600">{r.domainName}</td>
                          <td className="px-4 py-3">{scorePill(r.firstScore)}</td>
                          <td className="px-4 py-3">{scorePill(r.finalScore)}</td>
                          <td className="px-4 py-3 font-medium text-emerald-600">{imp > 0 ? `↑ ${imp}` : imp}</td>
                          <td className="px-4 py-3"><Badge tone={readinessTone(status)}>{status}</Badge></td>
                          <td className="px-4 py-3 text-slate-600">{r.ownerName}</td>
                          <td className="px-4 py-3 text-slate-500">{r.createdAt.slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
