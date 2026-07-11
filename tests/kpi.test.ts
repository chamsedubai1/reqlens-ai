import { describe, it, expect } from "vitest";
import {
  StoryReviewRecord,
  totalStories,
  averageFirstScore,
  averageFinalScore,
  aiDependencyIndex,
  readyOnFirstRate,
  qualityTrend,
  mostCommonWeakness,
} from "@/lib/kpi";

function rec(
  first: number,
  final: number,
  createdAt: string,
  weaknesses: string[] = [],
): StoryReviewRecord {
  return { firstSubmissionScore: first, finalScore: final, createdAt, weaknesses };
}

describe("basic aggregates", () => {
  const records = [
    rec(60, 80, "2026-01-01"),
    rec(70, 90, "2026-01-02"),
    rec(80, 100, "2026-01-03"),
  ];

  it("counts stories", () => {
    expect(totalStories(records)).toBe(3);
  });

  it("averages first and final scores", () => {
    expect(averageFirstScore(records)).toBe(70);
    expect(averageFinalScore(records)).toBe(90);
  });

  it("computes AI dependency index as final minus first average", () => {
    expect(aiDependencyIndex(records)).toBe(20);
  });

  it("computes ready-on-first rate (first >= 80)", () => {
    expect(readyOnFirstRate(records)).toBeCloseTo(1 / 3);
  });

  it("returns 0 for empty inputs without dividing by zero", () => {
    expect(averageFirstScore([])).toBe(0);
    expect(aiDependencyIndex([])).toBe(0);
    expect(readyOnFirstRate([])).toBe(0);
  });
});

describe("qualityTrend", () => {
  function series(firstScores: number[]): StoryReviewRecord[] {
    return firstScores.map((s, i) =>
      rec(s, s, `2026-02-${String(i + 1).padStart(2, "0")}`),
    );
  }

  it("returns Improving when latest five average >= previous five + 5", () => {
    expect(qualityTrend(series([50, 50, 50, 50, 50, 60, 60, 60, 60, 60]))).toBe(
      "Improving",
    );
  });

  it("returns Declining when latest five average <= previous five - 5", () => {
    expect(qualityTrend(series([60, 60, 60, 60, 60, 50, 50, 50, 50, 50]))).toBe(
      "Declining",
    );
  });

  it("returns Stable when the difference is within +/- 5", () => {
    expect(qualityTrend(series([60, 60, 60, 60, 60, 62, 62, 62, 62, 62]))).toBe(
      "Stable",
    );
  });
});

describe("mostCommonWeakness", () => {
  it("returns the most frequent weakness", () => {
    const records = [
      rec(60, 80, "2026-01-01", ["Acceptance Criteria", "Edge Cases"]),
      rec(70, 90, "2026-01-02", ["Acceptance Criteria"]),
      rec(80, 100, "2026-01-03", ["Testability"]),
    ];
    expect(mostCommonWeakness(records)).toBe("Acceptance Criteria");
  });

  it("returns null when there are no weaknesses", () => {
    expect(mostCommonWeakness([])).toBeNull();
  });
});
