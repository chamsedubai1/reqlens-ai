"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type AnalyticsRow,
  dashboardKpis,
  categoryQuality,
  trendSeries,
  drilldown,
} from "@/lib/analytics";
import { Card } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { storyRef } from "@/lib/story-ref";
import { clsx } from "@/lib/cx";
import {
  FileTextIcon, StarIcon, CheckCircleIcon, GaugeIcon, TargetIcon,
  ShieldCheckIcon, TrendingUpIcon, ChevronRightIcon,
} from "@/components/icons";

type IconT = (p: { className?: string }) => React.ReactNode;

const CAT_DOTS = [
  "bg-brand-100 text-brand", "bg-amber-100 text-amber-600", "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600", "bg-emerald-100 text-emerald-600", "bg-rose-100 text-rose-600",
];

export function DashboardKpis({ rows }: { rows: AnalyticsRow[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const k = dashboardKpis(rows);
  const cats = categoryQuality(rows);
  const trendVals = trendSeries(rows).map((t) => t.score);

  const primary: { key: string; label: string; value: string; Icon: IconT; tile: string; hint?: string; sparkline?: boolean }[] = [
    { key: "total", label: "Total Stories", value: String(k.total), Icon: FileTextIcon, tile: "bg-brand-100 text-brand" },
    { key: "avgFirst", label: "Avg First Score", value: String(k.avgFirst), Icon: StarIcon, tile: "bg-violet-100 text-violet-600" },
    { key: "avgFinal", label: "Avg Final Score", value: String(k.avgFinal), Icon: CheckCircleIcon, tile: "bg-emerald-100 text-emerald-600" },
    { key: "aiDependency", label: "AI Dependency", value: String(k.aiDependency), Icon: GaugeIcon, tile: "bg-amber-100 text-amber-600", hint: "Lower is better" },
    { key: "readyOnFirst", label: "Ready on First", value: `${k.readyOnFirstPct}%`, Icon: CheckCircleIcon, tile: "bg-sky-100 text-sky-600" },
    { key: "sprintReady", label: "Sprint-Ready", value: `${k.sprintReadyPct}%`, Icon: TargetIcon, tile: "bg-teal-100 text-teal-600" },
    { key: "domainAlignment", label: "Domain Alignment", value: String(k.avgDomainAlignment), Icon: ShieldCheckIcon, tile: "bg-indigo-100 text-indigo-600" },
    { key: "qualityTrend", label: "Quality Trend", value: k.trend, Icon: TrendingUpIcon, tile: "bg-brand-100 text-brand", sparkline: true },
  ];

  const drill = openKey ? drilldown(openKey, rows) : null;

  return (
    <div className="space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {primary.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOpenKey(c.key)}
            className="group text-left"
          >
            <Card className="relative p-4 transition group-hover:border-brand/30 group-hover:shadow-card">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</span>
                <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", c.tile)}><c.Icon className="h-4 w-4" /></span>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{c.value}</div>
              {c.hint && <div className="mt-0.5 text-[11px] text-slate-400">{c.hint}</div>}
              {c.sparkline && <div className="mt-1"><Sparkline values={trendVals} /></div>}
              <ChevronRightIcon className="absolute bottom-3 right-3 h-4 w-4 text-slate-300 opacity-0 transition group-hover:opacity-100 group-hover:text-brand" />
            </Card>
          </button>
        ))}
      </div>

      {/* Row 2 — category quality */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cats.map((c, i) => (
          <button key={c.key} type="button" onClick={() => setOpenKey(`cat:${c.key}`)} className="group text-left">
            <Card className="relative p-4 transition group-hover:border-brand/30 group-hover:shadow-card">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</span>
                <span className={clsx("h-3 w-3 rounded-full", CAT_DOTS[i % CAT_DOTS.length])} />
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">{c.pct}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
              </div>
              <ChevronRightIcon className="absolute bottom-3 right-3 h-4 w-4 text-slate-300 opacity-0 transition group-hover:opacity-100 group-hover:text-brand" />
            </Card>
          </button>
        ))}
      </div>

      {/* Drill-down modal */}
      {drill && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpenKey(null)}>
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold text-ink">{drill.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{drill.note}</p>
              </div>
              <button type="button" onClick={() => setOpenKey(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="overflow-auto p-2">
              {drill.items.length === 0 ? (
                <p className="p-6 text-center text-slate-500">No stories.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Ref</th>
                      <th className="px-3 py-2 font-semibold">Story</th>
                      <th className="px-3 py-2 font-semibold">Project</th>
                      <th className="px-3 py-2 font-semibold">Owner</th>
                      <th className="px-3 py-2 text-right font-semibold">{drill.metricLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drill.items.map((it) => (
                      <tr key={it.storyId} className="border-t border-slate-50 hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-3 py-2">
                          <Link href={`/stories/${it.storyId}`} className="font-mono text-xs font-semibold text-slate-500 hover:text-brand">{storyRef(it.reference, it.storyId, it.projectName)}</Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link href={`/stories/${it.storyId}`} className="font-medium text-brand hover:text-brand-dark">{it.storyTitle}</Link>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{it.projectName}</td>
                        <td className="px-3 py-2 text-slate-600">{it.ownerName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{it.metric}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
