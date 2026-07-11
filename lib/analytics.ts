import { SCORE_WEIGHTS } from "@/lib/scoring";

// One latest-review-per-story record, joined with story/project/owner context.
export type AnalyticsRow = {
  storyId: string;
  reference: number | null;
  storyTitle: string;
  storyStatus: string;
  projectId: string;
  projectName: string;
  domainName: string;
  ownerName: string;
  firstScore: number;
  finalScore: number;
  categories: {
    roleClarity: number;
    businessValue: number;
    functionalClarity: number;
    acceptanceCriteria: number;
    invest: number;
    edgeCases: number;
    testability: number;
  };
  domainAlignment: number;
  weaknesses: string[];
  createdAt: string; // ISO
};

// Reduce many review rows to the latest review per story (rows must be sorted
// createdAt descending, so the first seen per story is the newest).
export function latestAnalyticsPerStory(rows: AnalyticsRow[]): AnalyticsRow[] {
  const seen = new Set<string>();
  const out: AnalyticsRow[] = [];
  for (const r of rows) {
    if (!seen.has(r.storyId)) {
      seen.add(r.storyId);
      out.push(r);
    }
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const round = (n: number) => Math.round(n);
const pct = (n: number) => Math.round(n * 100);

export type Kpis = {
  total: number;
  avgFirst: number;
  avgFinal: number;
  aiDependency: number;
  readyOnFirstPct: number;
  sprintReadyPct: number;
  avgDomainAlignment: number;
  trend: "Improving" | "Stable" | "Declining";
  trendDelta: number;
};

export function dashboardKpis(rows: AnalyticsRow[]): Kpis {
  const first = rows.map((r) => r.firstScore);
  const final = rows.map((r) => r.finalScore);
  const avgFirst = round(mean(first));
  const avgFinal = round(mean(final));
  const ordered = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => r.firstScore);
  const last5 = ordered.slice(-5);
  const prev5 = ordered.slice(-10, -5);
  const delta = round(mean(last5) - mean(prev5));
  const trend = prev5.length === 0 ? "Stable" : delta >= 5 ? "Improving" : delta <= -5 ? "Declining" : "Stable";
  return {
    total: rows.length,
    avgFirst,
    avgFinal,
    aiDependency: avgFinal - avgFirst,
    readyOnFirstPct: rows.length ? pct(first.filter((s) => s >= 80).length / rows.length) : 0,
    sprintReadyPct: rows.length ? pct(final.filter((s) => s >= 80).length / rows.length) : 0,
    avgDomainAlignment: round(mean(rows.map((r) => r.domainAlignment))),
    trend,
    trendDelta: delta,
  };
}

export type CategoryQuality = { key: string; label: string; pct: number };

export function categoryQuality(rows: AnalyticsRow[]): CategoryQuality[] {
  const defs: [keyof AnalyticsRow["categories"], string, number][] = [
    ["acceptanceCriteria", "Acceptance Criteria", SCORE_WEIGHTS.acceptanceCriteria],
    ["businessValue", "Business Value", SCORE_WEIGHTS.businessValue],
    ["edgeCases", "Edge Case Coverage", SCORE_WEIGHTS.edgeCases],
    ["testability", "Testability", SCORE_WEIGHTS.testability],
    ["invest", "INVEST Compliance", SCORE_WEIGHTS.investCompliance],
    ["functionalClarity", "Functional Clarity", SCORE_WEIGHTS.functionalClarity],
  ];
  return defs.map(([key, label, max]) => ({
    key,
    label,
    pct: rows.length ? pct(mean(rows.map((r) => r.categories[key])) / max) : 0,
  }));
}

export type ScoreBand = { band: string; count: number; pct: number; color: string };

export function scoreDistribution(rows: AnalyticsRow[]): ScoreBand[] {
  const bands = [
    { band: "80–100", min: 80, color: "#10b981" },
    { band: "60–79", min: 60, color: "#3b82f6" },
    { band: "40–59", min: 40, color: "#f59e0b" },
    { band: "0–39", min: 0, color: "#ef4444" },
  ];
  return bands.map((b, i) => {
    const max = i === 0 ? 101 : bands[i - 1].min;
    const count = rows.filter((r) => r.finalScore >= b.min && r.finalScore < max).length;
    return { band: b.band, count, pct: rows.length ? pct(count / rows.length) : 0, color: b.color };
  });
}

export type ProjectStat = {
  projectId: string;
  projectName: string;
  avgFirst: number;
  avgFinal: number;
  ready: number;
  needs: number;
  notReady: number;
  total: number;
};

export function byProject(rows: AnalyticsRow[]): ProjectStat[] {
  const groups = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    const arr = groups.get(r.projectId) ?? [];
    arr.push(r);
    groups.set(r.projectId, arr);
  }
  return [...groups.values()]
    .map((g) => ({
      projectId: g[0].projectId,
      projectName: g[0].projectName,
      avgFirst: round(mean(g.map((r) => r.firstScore))),
      avgFinal: round(mean(g.map((r) => r.finalScore))),
      ready: g.filter((r) => r.finalScore >= 80).length,
      needs: g.filter((r) => r.finalScore >= 65 && r.finalScore < 80).length,
      notReady: g.filter((r) => r.finalScore < 65).length,
      total: g.length,
    }))
    .sort((a, b) => b.avgFinal - a.avgFinal);
}

export type TrendPoint = { date: string; score: number };

export function trendSeries(rows: AnalyticsRow[]): TrendPoint[] {
  return [...rows]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({ date: r.createdAt.slice(0, 10), score: r.firstScore }));
}

export type Heatmap = { categories: string[]; projects: string[]; cells: number[][] };

export function weaknessHeatmap(rows: AnalyticsRow[]): Heatmap {
  const cats: [keyof AnalyticsRow["categories"], string, number][] = [
    ["acceptanceCriteria", "Acceptance", SCORE_WEIGHTS.acceptanceCriteria],
    ["businessValue", "Business Value", SCORE_WEIGHTS.businessValue],
    ["edgeCases", "Edge Cases", SCORE_WEIGHTS.edgeCases],
    ["functionalClarity", "Clarity", SCORE_WEIGHTS.functionalClarity],
    ["testability", "Testability", SCORE_WEIGHTS.testability],
  ];
  const projects = byProject(rows).slice(0, 5);
  return {
    categories: cats.map((c) => c[1]),
    projects: projects.map((p) => p.projectName),
    cells: cats.map(([key, , max]) =>
      projects.map((p) => {
        const g = rows.filter((r) => r.projectId === p.projectId);
        return g.length ? pct(mean(g.map((r) => r.categories[key])) / max) : 0;
      }),
    ),
  };
}

// --- KPI drill-down: given a KPI key, return the stories driving that metric ---

export type DrillItem = {
  storyId: string;
  reference: number | null;
  storyTitle: string;
  projectName: string;
  ownerName: string;
  metric: string;
};
export type DrillResult = { title: string; metricLabel: string; note: string; items: DrillItem[] };

const CAT_MAX: Record<string, number> = {
  roleClarity: SCORE_WEIGHTS.roleClarity,
  businessValue: SCORE_WEIGHTS.businessValue,
  functionalClarity: SCORE_WEIGHTS.functionalClarity,
  acceptanceCriteria: SCORE_WEIGHTS.acceptanceCriteria,
  invest: SCORE_WEIGHTS.investCompliance,
  edgeCases: SCORE_WEIGHTS.edgeCases,
  testability: SCORE_WEIGHTS.testability,
};
const CAT_LABEL: Record<string, string> = {
  acceptanceCriteria: "Acceptance Criteria",
  businessValue: "Business Value",
  edgeCases: "Edge Case Coverage",
  testability: "Testability",
  invest: "INVEST Compliance",
  functionalClarity: "Functional Clarity",
  roleClarity: "Role Clarity",
};

function toItem(r: AnalyticsRow, metric: string): DrillItem {
  return { storyId: r.storyId, reference: r.reference, storyTitle: r.storyTitle, projectName: r.projectName, ownerName: r.ownerName, metric };
}
function sortBy(rows: AnalyticsRow[], f: (r: AnalyticsRow) => number, dir: "asc" | "desc" = "asc"): AnalyticsRow[] {
  return [...rows].sort((a, b) => (dir === "asc" ? f(a) - f(b) : f(b) - f(a)));
}

export function drilldown(key: string, rows: AnalyticsRow[]): DrillResult {
  if (key.startsWith("cat:")) {
    const catKey = key.slice(4) as keyof AnalyticsRow["categories"];
    const max = CAT_MAX[catKey] ?? 0;
    return {
      title: `${CAT_LABEL[catKey] ?? catKey} — by story`,
      metricLabel: "Score",
      note: "Lowest-scoring stories first — these drag the metric down.",
      items: sortBy(rows, (r) => r.categories[catKey], "asc").map((r) => toItem(r, `${r.categories[catKey]}/${max}`)),
    };
  }
  switch (key) {
    case "total":
      return { title: "All reviewed stories", metricLabel: "Reviewed", note: "Every story in this view, newest first.", items: sortBy(rows, (r) => Date.parse(r.createdAt), "desc").map((r) => toItem(r, r.createdAt.slice(0, 10))) };
    case "avgFirst":
      return { title: "First-submission scores", metricLabel: "First", note: "Lowest first submissions first.", items: sortBy(rows, (r) => r.firstScore).map((r) => toItem(r, String(r.firstScore))) };
    case "avgFinal":
      return { title: "Final scores", metricLabel: "Final", note: "Lowest final scores first.", items: sortBy(rows, (r) => r.finalScore).map((r) => toItem(r, String(r.finalScore))) };
    case "aiDependency":
      return { title: "AI improvement per story", metricLabel: "Improvement", note: "Biggest AI lift first (final − first).", items: sortBy(rows, (r) => r.finalScore - r.firstScore, "desc").map((r) => { const g = r.finalScore - r.firstScore; return toItem(r, g > 0 ? `+${g}` : String(g)); }) };
    case "readyOnFirst": {
      const ready = rows.filter((r) => r.firstScore >= 80);
      return { title: "Ready on first submission", metricLabel: "First", note: ready.length ? "Stories with a first score ≥ 80." : "None reached ≥ 80 on first — closest shown.", items: sortBy(ready.length ? ready : rows, (r) => r.firstScore, "desc").map((r) => toItem(r, String(r.firstScore))) };
    }
    case "sprintReady": {
      const rr = rows.filter((r) => r.finalScore >= 80);
      return { title: "Sprint-ready stories", metricLabel: "Final", note: "Stories with a final score ≥ 80.", items: sortBy(rr.length ? rr : rows, (r) => r.finalScore, "desc").map((r) => toItem(r, String(r.finalScore))) };
    }
    case "domainAlignment":
      return { title: "Domain alignment by story", metricLabel: "Alignment", note: "Lowest alignment first.", items: sortBy(rows, (r) => r.domainAlignment).map((r) => toItem(r, String(r.domainAlignment))) };
    case "qualityTrend":
      return { title: "First scores over time", metricLabel: "First", note: "Chronological — oldest to newest.", items: sortBy(rows, (r) => Date.parse(r.createdAt), "asc").map((r) => toItem(r, String(r.firstScore))) };
    default:
      return { title: "Stories", metricLabel: "Final", note: "", items: rows.map((r) => toItem(r, String(r.finalScore))) };
  }
}

export function insights(rows: AnalyticsRow[]): string[] {
  if (rows.length === 0) return ["Create and review stories to see AI insights here."];
  const out: string[] = [];
  const k = dashboardKpis(rows);
  const cats = categoryQuality(rows).sort((a, b) => a.pct - b.pct);
  const projects = byProject(rows);
  if (projects.length) {
    const top = projects[0];
    out.push(`${top.projectName} leads with an average final score of ${top.avgFinal}.`);
  }
  if (cats.length) {
    out.push(`${cats[0].label} is the top weakness (${cats[0].pct}%) — focus there to reduce rework.`);
  }
  out.push(
    k.trend === "Improving"
      ? `Quality trend is improving (+${k.trendDelta} pts on recent first submissions).`
      : k.trend === "Declining"
        ? `Quality trend is declining (${k.trendDelta} pts) — review recent submissions.`
        : "Quality trend is stable across recent submissions.",
  );
  out.push(`AI Dependency Index is ${k.aiDependency}: the AI lifts stories ${k.aiDependency} points on average.`);
  return out;
}
