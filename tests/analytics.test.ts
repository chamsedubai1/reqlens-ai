import { describe, it, expect } from "vitest";
import {
  dashboardKpis,
  categoryQuality,
  scoreDistribution,
  byProject,
  trendSeries,
  weaknessHeatmap,
  insights,
  drilldown,
  type AnalyticsRow,
} from "@/lib/analytics";

function row(over: Partial<AnalyticsRow>): AnalyticsRow {
  return {
    storyId: "s",
    storyTitle: "S",
    storyStatus: "REVIEWED",
    projectId: "p1",
    projectName: "Mobile Banking",
    domainName: "Payments",
    ownerName: "Priya",
    firstScore: 70,
    finalScore: 85,
    categories: {
      roleClarity: 9, businessValue: 12, functionalClarity: 12,
      acceptanceCriteria: 16, invest: 16, edgeCases: 5, testability: 8,
    },
    domainAlignment: 88,
    weaknesses: ["Edge Cases"],
    createdAt: "2026-05-01",
    ...over,
  };
}

const rows: AnalyticsRow[] = [
  row({ projectId: "p1", projectName: "Mobile Banking", firstScore: 60, finalScore: 90, createdAt: "2026-05-01" }),
  row({ projectId: "p1", projectName: "Mobile Banking", firstScore: 80, finalScore: 80, createdAt: "2026-05-02" }),
  row({ projectId: "p2", projectName: "Payments", firstScore: 50, finalScore: 55, createdAt: "2026-05-03" }),
];

describe("dashboardKpis", () => {
  it("computes core aggregates", () => {
    const k = dashboardKpis(rows);
    expect(k.total).toBe(3);
    expect(k.avgFirst).toBe(63); // (60+80+50)/3 = 63.33 -> 63
    expect(k.avgFinal).toBe(75); // (90+80+55)/3 = 75
    expect(k.aiDependency).toBe(12); // 75-63
    expect(k.readyOnFirstPct).toBe(33); // 1 of 3 first>=80
    expect(k.sprintReadyPct).toBe(67); // 2 of 3 final>=80
  });
  it("is safe on empty input", () => {
    const k = dashboardKpis([]);
    expect(k.total).toBe(0);
    expect(k.avgFinal).toBe(0);
    expect(k.trend).toBe("Stable");
  });
});

describe("scoreDistribution", () => {
  it("buckets final scores into bands", () => {
    const dist = scoreDistribution(rows);
    const byBand = Object.fromEntries(dist.map((d) => [d.band, d.count]));
    expect(byBand["80–100"]).toBe(2); // 90, 80
    expect(byBand["40–59"]).toBe(1); // 55
  });
});

describe("byProject", () => {
  it("groups and sorts projects by final score", () => {
    const ps = byProject(rows);
    expect(ps).toHaveLength(2);
    expect(ps[0].projectName).toBe("Mobile Banking");
    expect(ps[0].avgFinal).toBe(85); // (90+80)/2
    expect(ps[0].ready).toBe(2);
    expect(ps[1].notReady).toBe(1); // Payments final 55 < 65
  });
});

describe("categoryQuality / heatmap / trend / insights", () => {
  it("returns category percentages", () => {
    const cq = categoryQuality(rows);
    const ac = cq.find((c) => c.key === "acceptanceCriteria");
    expect(ac?.pct).toBe(80); // 16/20
  });
  it("builds a heatmap matrix", () => {
    const h = weaknessHeatmap(rows);
    expect(h.projects).toContain("Mobile Banking");
    expect(h.cells.length).toBe(h.categories.length);
    expect(h.cells[0].length).toBe(h.projects.length);
  });
  it("orders the trend by date", () => {
    const t = trendSeries(rows);
    expect(t.map((p) => p.score)).toEqual([60, 80, 50]);
  });
  it("produces non-empty insights", () => {
    expect(insights(rows).length).toBeGreaterThan(0);
    expect(insights([])[0]).toContain("Create and review");
  });
});

describe("drilldown", () => {
  it("sprintReady lists only final>=80 stories", () => {
    const d = drilldown("sprintReady", rows);
    expect(d.items).toHaveLength(2); // final 90, 80
    expect(d.items.every((i) => Number(i.metric) >= 80)).toBe(true);
  });
  it("avgFirst is sorted weakest-first with all stories", () => {
    const d = drilldown("avgFirst", rows);
    expect(d.items.map((i) => i.metric)).toEqual(["50", "60", "80"]);
  });
  it("aiDependency shows improvement, biggest first", () => {
    const d = drilldown("aiDependency", rows);
    expect(d.items[0].metric).toBe("+30"); // 90-60
    expect(d.metricLabel).toBe("Improvement");
  });
  it("category drill (cat:acceptanceCriteria) reports score/max, weakest first", () => {
    const d = drilldown("cat:acceptanceCriteria", rows);
    expect(d.items[0].metric).toContain("/20");
    expect(d.title).toContain("Acceptance Criteria");
  });
  it("readyOnFirst falls back to closest when none qualify", () => {
    const low = rows.map((r) => ({ ...r, firstScore: 50 }));
    const d = drilldown("readyOnFirst", low);
    expect(d.items).toHaveLength(low.length);
    expect(d.note).toContain("closest");
  });
});
