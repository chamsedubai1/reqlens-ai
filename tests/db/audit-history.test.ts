import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant, createProject, createDomain, createStory, createReview,
  createAuditLog, listAuditLogs, listReviewsForStory, listReviewAnalytics,
} from "@/lib/db/queries";
import { buildReviewInsert } from "@/lib/review/record";
import { mockReview } from "@/lib/ai/mock";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { if (close) await close(); close = undefined; });

async function seed(db: Awaited<ReturnType<typeof createTestDb>>["db"], name: string) {
  return createUserWithTenant(db, { fullName: `Admin ${name}`, email: `admin@${name}.test`, passwordHash: "h", tenantName: name });
}
async function makeStory(db: Awaited<ReturnType<typeof createTestDb>>["db"], t: { tenantId: string; userId: string }) {
  const domain = await createDomain(db, t.tenantId, t.userId, { name: "Payments" });
  const project = await createProject(db, t.tenantId, t.userId, { name: "P" });
  const story = await createStory(db, t.tenantId, t.userId, {
    projectId: project.id, domainId: domain.id, title: "S",
    userRole: "customer", goal: "g", businessValue: "v", description: "d", acceptanceCriteria: "AC",
  });
  return { domain, project, story };
}
function reviewInsert(final: number, prevFirst: number | null) {
  const r = mockReview({ story: { title: "S", userRole: "c", goal: "g", businessValue: "v", description: "d" }, domain: { name: "P" }, documents: [] });
  return buildReviewInsert({ ...r, overallScore: final, readinessStatus: r.readinessStatus }, prevFirst);
}

describe("audit logs", () => {
  it("records and lists entries with the actor name, tenant-scoped", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");

    await createAuditLog(t.db, a.tenantId, { userId: a.userId, action: "project.created", entityType: "project", entityId: null, metadata: { name: "X" } });
    const logs = await listAuditLogs(t.db, a.tenantId);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("project.created");
    expect(logs[0].actorName).toBe("Admin alpha");

    expect(await listAuditLogs(t.db, b.tenantId)).toHaveLength(0);
  });
});

describe("review history", () => {
  it("returns all reviews for a story newest-first", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const { story, project, domain } = await makeStory(t.db, a);
    const ctx = { storyId: story.id, projectId: project.id, domainId: domain.id, userId: a.userId };

    await createReview(t.db, a.tenantId, ctx, reviewInsert(65, null));
    await createReview(t.db, a.tenantId, ctx, reviewInsert(88, 65));

    const history = await listReviewsForStory(t.db, a.tenantId, story.id);
    expect(history).toHaveLength(2);
    expect(history[0].finalScore).toBe(88); // newest first
    expect(history[1].finalScore).toBe(65);
    expect(history[0].firstSubmissionScore).toBe(65); // preserved
  });
});

describe("listReviewAnalytics scoping", () => {
  it("filters to a single user when userId is given, and isolates tenants", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    // second user in same tenant
    const other = await createUserWithTenant(t.db, { fullName: "BA", email: "ba@x.test", passwordHash: "h", tenantName: "gamma" });

    const s1 = await makeStory(t.db, a);
    await createReview(t.db, a.tenantId, { storyId: s1.story.id, projectId: s1.project.id, domainId: s1.domain.id, userId: a.userId }, reviewInsert(80, null));

    const all = await listReviewAnalytics(t.db, a.tenantId);
    expect(all).toHaveLength(1);
    const mine = await listReviewAnalytics(t.db, a.tenantId, a.userId);
    expect(mine).toHaveLength(1);
    const none = await listReviewAnalytics(t.db, a.tenantId, "00000000-0000-0000-0000-000000000000");
    expect(none).toHaveLength(0);
    // other tenant sees nothing
    expect(await listReviewAnalytics(t.db, other.tenantId)).toHaveLength(0);
  });
});
