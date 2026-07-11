export interface StoryReviewRecord {
  firstSubmissionScore: number;
  finalScore: number;
  weaknesses: string[];
  createdAt: string; // ISO date string
}

export type QualityTrend = "Improving" | "Stable" | "Declining";

export function totalStories(records: StoryReviewRecord[]): number {
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
