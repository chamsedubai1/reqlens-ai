"use client";

import Link from "next/link";
import type { AnalyticsRow } from "@/lib/analytics";
import { DataTable } from "@/components/DataTable";
import { Badge, readinessTone } from "@/components/ui";
import { readinessStatus } from "@/lib/scoring";
import { storyRef } from "@/lib/story-ref";
import { clsx } from "@/lib/cx";

function scorePill(score: number) {
  const tone = score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 65 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={clsx("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", tone)}>{score}</span>;
}

export function StoriesTable({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <DataTable<AnalyticsRow>
      rows={rows}
      getRowKey={(r) => r.storyId}
      initialSortKey="reviewed"
      initialSortDir="desc"
      searchPlaceholder="Search stories, owners…"
      columns={[
        { key: "ref", header: "Ref", filterText: (r) => storyRef(r.reference, r.storyId, r.projectName), sortValue: (r) => r.reference ?? 0, className: "whitespace-nowrap", render: (r) => <Link href={`/stories/${r.storyId}`} className="font-mono text-xs font-semibold text-slate-500 hover:text-brand">{storyRef(r.reference, r.storyId, r.projectName)}</Link> },
        { key: "story", header: "Story", filterText: (r) => r.storyTitle, render: (r) => <Link href={`/stories/${r.storyId}`} className="font-medium text-brand hover:text-brand-dark">{r.storyTitle}</Link> },
        { key: "project", header: "Project", facet: true, filterText: (r) => r.projectName, render: (r) => <span className="text-slate-600">{r.projectName}</span> },
        { key: "domain", header: "Domain", facet: true, filterText: (r) => r.domainName, render: (r) => <span className="text-slate-600">{r.domainName}</span> },
        { key: "first", header: "First", sortValue: (r) => r.firstScore, render: (r) => scorePill(r.firstScore) },
        { key: "latest", header: "Latest", sortValue: (r) => r.finalScore, render: (r) => scorePill(r.finalScore) },
        { key: "improvement", header: "Improvement", sortValue: (r) => r.finalScore - r.firstScore, render: (r) => { const i = r.finalScore - r.firstScore; return <span className="font-medium text-emerald-600">{i > 0 ? `↑ ${i}` : i}</span>; } },
        { key: "readiness", header: "Readiness", facet: true, filterText: (r) => readinessStatus(r.finalScore), render: (r) => { const s = readinessStatus(r.finalScore); return <Badge tone={readinessTone(s)}>{s}</Badge>; } },
        { key: "owner", header: "Owner", facet: true, filterText: (r) => r.ownerName, render: (r) => <span className="text-slate-600">{r.ownerName}</span> },
        { key: "reviewed", header: "Last Reviewed", sortValue: (r) => Date.parse(r.createdAt), filterText: (r) => r.createdAt.slice(0, 10), render: (r) => <span className="text-slate-500">{r.createdAt.slice(0, 10)}</span> },
      ]}
    />
  );
}
