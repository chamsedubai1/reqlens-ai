import { describe, it, expect } from "vitest";
import { latestReviewPerStory } from "@/lib/kpi";

describe("latestReviewPerStory", () => {
  it("keeps only the most recent review per story", () => {
    const rows = [
      { storyId: "s1", firstSubmissionScore: 60, finalScore: 70, weaknesses: ["A"], createdAt: "2026-01-01" },
      { storyId: "s1", firstSubmissionScore: 60, finalScore: 85, weaknesses: ["A"], createdAt: "2026-01-02" },
      { storyId: "s2", firstSubmissionScore: 80, finalScore: 80, weaknesses: [], createdAt: "2026-01-01" },
    ];
    const records = latestReviewPerStory(rows);
    expect(records).toHaveLength(2);
    const s1 = records.find((r) => r.finalScore === 85 || r.finalScore === 70);
    expect(s1?.finalScore).toBe(85);
  });
});
