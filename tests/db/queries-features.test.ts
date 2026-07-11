import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import {
  createUserWithTenant,
  createProject,
  createDomain,
  createStory,
  getProject,
  getDomain,
  getStory,
  listStoriesByProject,
  createDocument,
  listDocumentsByDomain,
  listProcessedDocumentsByDomain,
} from "@/lib/db/queries";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  if (close) await close();
  close = undefined;
});

async function seed(db: Awaited<ReturnType<typeof createTestDb>>["db"], name: string) {
  return createUserWithTenant(db, {
    fullName: `Admin ${name}`,
    email: `admin@${name}.test`,
    passwordHash: "hash",
    tenantName: name,
  });
}

describe("tenant-scoped gets", () => {
  it("getProject/getDomain/getStory return the row for the owning tenant and undefined for others", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");

    const proj = await createProject(t.db, a.tenantId, a.userId, { name: "A App" });
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });
    const story = await createStory(t.db, a.tenantId, a.userId, {
      projectId: proj.id,
      domainId: dom.id,
      title: "S",
      userRole: "customer",
      goal: "g",
      businessValue: "v",
      description: "d",
    });

    expect((await getProject(t.db, a.tenantId, proj.id))?.name).toBe("A App");
    expect(await getProject(t.db, b.tenantId, proj.id)).toBeUndefined();
    expect((await getDomain(t.db, a.tenantId, dom.id))?.name).toBe("Payments");
    expect(await getDomain(t.db, b.tenantId, dom.id)).toBeUndefined();
    expect((await getStory(t.db, a.tenantId, story.id))?.title).toBe("S");
    expect(await getStory(t.db, b.tenantId, story.id)).toBeUndefined();
  });

  it("listStoriesByProject returns only that project's stories for the tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });
    const p1 = await createProject(t.db, a.tenantId, a.userId, { name: "P1" });
    const p2 = await createProject(t.db, a.tenantId, a.userId, { name: "P2" });
    const base = { domainId: dom.id, userRole: "c", goal: "g", businessValue: "v", description: "d" };
    await createStory(t.db, a.tenantId, a.userId, { projectId: p1.id, title: "one", ...base });
    await createStory(t.db, a.tenantId, a.userId, { projectId: p2.id, title: "two", ...base });

    const p1Stories = await listStoriesByProject(t.db, a.tenantId, p1.id);
    expect(p1Stories.map((s) => s.title)).toEqual(["one"]);
  });
});

describe("documents", () => {
  it("createDocument stores text and lists by domain; processed filter works", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const dom = await createDomain(t.db, a.tenantId, a.userId, { name: "Payments" });

    await createDocument(t.db, a.tenantId, a.userId, {
      domainId: dom.id,
      title: "Policy",
      contentText: "Transfers above 50000 require OTP.",
    });
    const docs = await listDocumentsByDomain(t.db, a.tenantId, dom.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].contentText).toContain("OTP");
    expect(docs[0].processingStatus).toBe("PROCESSED");

    const processed = await listProcessedDocumentsByDomain(t.db, a.tenantId, dom.id);
    expect(processed).toHaveLength(1);
  });

  it("createDocument rejects a domain from another tenant", async () => {
    const t = await createTestDb();
    close = t.close;
    const a = await seed(t.db, "alpha");
    const b = await seed(t.db, "beta");
    const domB = await createDomain(t.db, b.tenantId, b.userId, { name: "B" });
    await expect(
      createDocument(t.db, a.tenantId, a.userId, {
        domainId: domB.id,
        title: "X",
        contentText: "leak",
      }),
    ).rejects.toThrow();
  });
});
