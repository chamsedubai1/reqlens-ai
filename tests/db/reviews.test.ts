import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant, createProject, createDomain, createStory,
  createReview, getFirstReviewScoreForStory, listReviewsForKpi, setStoryStatus, getStory,
} from "@/lib/db/queries";
import { buildReviewInsert } from "@/lib/review/record";
import { mockReview } from "@/lib/ai/mock";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { if (close) await close(); close = undefined; });

async function setup(db: Awaited<ReturnType<typeof createTestDb>>["db"]) {
  const a = await createUserWithTenant(db, { fullName: "A", email: "a@a.test", passwordHash: "h", tenantName: "a" });
  const domain = await createDomain(db, a.tenantId, a.userId, { name: "Payments" });
  const project = await createProject(db, a.tenantId, a.userId, { name: "P" });
  const story = await createStory(db, a.tenantId, a.userId, {
    projectId: project.id, domainId: domain.id, title: "S",
    userRole: "customer", goal: "g", businessValue: "v", description: "d",
    acceptanceCriteria: "AC",
  });
  return { ...a, domain, project, story };
}

describe("review persistence", () => {
  it("saves a review, preserves the first score, and lists KPI rows", async () => {
    const t = await createTestDb();
    close = t.close;
    const s = await setup(t.db);
    const ctx = { storyId: s.story.id, projectId: s.project.id, domainId: s.domain.id, userId: s.userId };

    const review = mockReview({
      story: s.story, domain: { name: "Payments" }, documents: [],
    });
    const prevFirst = await getFirstReviewScoreForStory(t.db, s.tenantId, s.story.id);
    expect(prevFirst).toBeNull();
    await createReview(t.db, s.tenantId, ctx, buildReviewInsert(review, prevFirst));
    await setStoryStatus(t.db, s.tenantId, s.story.id, "REVIEWED");

    expect((await getStory(t.db, s.tenantId, s.story.id))?.status).toBe("REVIEWED");
    const firstAfter = await getFirstReviewScoreForStory(t.db, s.tenantId, s.story.id);
    expect(firstAfter).toBe(review.overallScore);

    const rows = await listReviewsForKpi(t.db, s.tenantId, s.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].storyId).toBe(s.story.id);
    expect(Array.isArray(rows[0].weaknesses)).toBe(true);
  });

  it("does not return another tenant's review rows", async () => {
    const t = await createTestDb();
    close = t.close;
    const s = await setup(t.db);
    const other = await createUserWithTenant(t.db, { fullName: "B", email: "b@b.test", passwordHash: "h", tenantName: "b" });
    const ctx = { storyId: s.story.id, projectId: s.project.id, domainId: s.domain.id, userId: s.userId };
    await createReview(t.db, s.tenantId, ctx, buildReviewInsert(mockReview({ story: s.story, domain: { name: "P" }, documents: [] }), null));

    expect(await listReviewsForKpi(t.db, other.tenantId, other.userId)).toHaveLength(0);
  });
});
