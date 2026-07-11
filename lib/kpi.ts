export interface StoryReviewRecord {
  firstSubmissionScore: number;
  finalScore: number;
  weaknesses: string[];
  createdAt: string; // ISO date string
}

export type QualityTrend = "Improving" | "Stable" | "Declining";

// Accepts any array (e.g. all of the user's stories, or just reviewed-story
// records) — "Total stories created" per CLAUDE.md KPI #1 counts every story,
// not only the ones that have been reviewed, so this is intentionally wider
// than StoryReviewRecord[].
export function totalStories(records: unknown[]): number {
  return records.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function averageFirstScore(records: StoryReviewRecord[]): number {
  return Math.round(mean(records.map((r) => r.firstSubmissionScore)));
}

export function averageFinalScore(records: StoryReviewRecord[]): number {
  return Math.round(mean(records.map((r) => r.finalScore)));
}

export function aiDependencyIndex(records: StoryReviewRecord[]): number {
  return averageFinalScore(records) - averageFirstScore(records);
}

export function readyOnFirstRate(records: StoryReviewRecord[]): number {
  if (records.length === 0) return 0;
  const ready = records.filter((r) => r.firstSubmissionScore >= 80).length;
  return ready / records.length;
}

export function qualityTrend(records: StoryReviewRecord[]): QualityTrend {
  const ordered = [...records].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const firstScores = ordered.map((r) => r.firstSubmissionScore);
  const latest5 = firstScores.slice(-5);
  const previous5 = firstScores.slice(-10, -5);
  // No prior five-story window to compare against yet (fewer than 6 stories):
  // report Stable rather than a spurious "Improving" from comparing against a zero baseline.
  if (previous5.length === 0) return "Stable";
  const diff = mean(latest5) - mean(previous5);
  if (diff >= 5) return "Improving";
  if (diff <= -5) return "Declining";
  return "Stable";
}

export function mostCommonWeakness(
  records: StoryReviewRecord[],
): string | null {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const weakness of record.weaknesses) {
      counts.set(weakness, (counts.get(weakness) ?? 0) + 1);
    }
  }
  let top: string | null = null;
  let topCount = 0;
  for (const [weakness, count] of counts) {
    if (count > topCount) {
      top = weakness;
      topCount = count;
    }
  }
  return top;
}

export function latestReviewPerStory(
  rows: {
    storyId: string;
    firstSubmissionScore: number;
    finalScore: number;
    weaknesses: string[];
    createdAt: string;
  }[],
): StoryReviewRecord[] {
  const byStory = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const current = byStory.get(row.storyId);
    if (!current || row.createdAt > current.createdAt) {
      byStory.set(row.storyId, row);
    }
  }
  return [...byStory.values()].map((r) => ({
    firstSubmissionScore: r.firstSubmissionScore,
    finalScore: r.finalScore,
    weaknesses: r.weaknesses,
    createdAt: r.createdAt,
  }));
}
