import { and, eq, asc, desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  tenants,
  userProfiles,
  projects,
  businessDomains,
  userStories,
  domainDocuments,
  storyReviews,
} from "@/lib/db/schema";

export type UserProfile = typeof userProfiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type BusinessDomain = typeof businessDomains.$inferSelect;
export type UserStory = typeof userStories.$inferSelect;

export async function getUserProfileByEmail(
  db: Db,
  email: string,
): Promise<UserProfile | undefined> {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.email, email))
    .limit(1);
  return rows[0];
}

export async function getUserProfileById(
  db: Db,
  id: string,
): Promise<UserProfile | undefined> {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, id))
    .limit(1);
  return rows[0];
}

// Creates a new tenant and its first user (TENANT_ADMIN) in one transaction.
// tenant_id is generated server-side; never supplied by the client.
export async function createUserWithTenant(
  db: Db,
  input: {
    fullName: string;
    email: string;
    passwordHash: string;
    tenantName: string;
  },
): Promise<{ userId: string; tenantId: string }> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.tenantName })
      .returning();
    const [profile] = await tx
      .insert(userProfiles)
      .values({
        tenantId: tenant.id,
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "TENANT_ADMIN",
      })
      .returning();
    return { userId: profile.id, tenantId: tenant.id };
  });
}

export async function createProject(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: { name: string; description?: string },
): Promise<Project> {
  const [row] = await db
    .insert(projects)
    .values({
      tenantId,
      createdBy,
      name: input.name,
      description: input.description,
    })
    .returning();
  return row;
}

export async function listProjects(db: Db, tenantId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.tenantId, tenantId));
}

export async function createDomain(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: { name: string; description?: string },
): Promise<BusinessDomain> {
  const [row] = await db
    .insert(businessDomains)
    .values({
      tenantId,
      createdBy,
      name: input.name,
      description: input.description,
    })
    .returning();
  return row;
}

export async function listDomains(
  db: Db,
  tenantId: string,
): Promise<BusinessDomain[]> {
  return db
    .select()
    .from(businessDomains)
    .where(eq(businessDomains.tenantId, tenantId));
}

export type StoryRow = {
  projectId: string;
  domainId: string;
  title: string;
  userRole: string;
  goal: string;
  businessValue: string;
  description: string;
  acceptanceCriteria?: string;
  businessRules?: string;
  edgeCases?: string;
};

export async function createStory(
  db: Db,
  tenantId: string,
  createdBy: string,
  input: StoryRow,
): Promise<UserStory> {
  // The FK constraints only enforce that the project/domain exist — not that they
  // belong to this tenant. Verify tenant ownership here so a caller can never attach
  // a story to another tenant's project or domain (which would later leak that
  // tenant's domain documents into the AI-review prompt).
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (project.length === 0) {
    throw new Error("Project does not belong to this tenant");
  }
  const domain = await db
    .select({ id: businessDomains.id })
    .from(businessDomains)
    .where(
      and(
        eq(businessDomains.id, input.domainId),
        eq(businessDomains.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (domain.length === 0) {
    throw new Error("Business domain does not belong to this tenant");
  }

  const [row] = await db
    .insert(userStories)
    .values({ tenantId, createdBy, ...input })
    .returning();
  return row;
}

export async function listStoriesByUser(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<UserStory[]> {
  return db
    .select()
    .from(userStories)
    .where(
      and(
        eq(userStories.tenantId, tenantId),
        eq(userStories.createdBy, userId),
      ),
    );
}

export type DomainDocument = typeof domainDocuments.$inferSelect;

export async function getProject(
  db: Db,
  tenantId: string,
  id: string,
): Promise<Project | undefined> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function getDomain(
  db: Db,
  tenantId: string,
  id: string,
): Promise<BusinessDomain | undefined> {
  const rows = await db
    .select()
    .from(businessDomains)
    .where(and(eq(businessDomains.id, id), eq(businessDomains.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function getStory(
  db: Db,
  tenantId: string,
  id: string,
): Promise<UserStory | undefined> {
  const rows = await db
    .select()
    .from(userStories)
    .where(and(eq(userStories.id, id), eq(userStories.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}

export async function listStoriesByProject(
  db: Db,
  tenantId: string,
  projectId: string,
): Promise<UserStory[]> {
  return db
    .select()
    .from(userStories)
    .where(
      and(
        eq(userStories.tenantId, tenantId),
        eq(userStories.projectId, projectId),
      ),
    );
}

export type DocumentRow = {
  domainId: string;
  title: string;
  contentText: string;
  fileName?: string;
  fileType?: string;
};

export async function createDocument(
  db: Db,
  tenantId: string,
  uploadedBy: string,
  input: DocumentRow,
): Promise<DomainDocument> {
  // Verify the domain belongs to this tenant before attaching a document.
  const domain = await db
    .select({ id: businessDomains.id })
    .from(businessDomains)
    .where(
      and(
        eq(businessDomains.id, input.domainId),
        eq(businessDomains.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (domain.length === 0) {
    throw new Error("Business domain does not belong to this tenant");
  }
  const [row] = await db
    .insert(domainDocuments)
    .values({
      tenantId,
      uploadedBy,
      domainId: input.domainId,
      title: input.title,
      contentText: input.contentText,
      fileName: input.fileName,
      fileType: input.fileType,
      processingStatus: "PROCESSED",
    })
    .returning();
  return row;
}

export async function listDocumentsByDomain(
  db: Db,
  tenantId: string,
  domainId: string,
): Promise<DomainDocument[]> {
  return db
    .select()
    .from(domainDocuments)
    .where(
      and(
        eq(domainDocuments.tenantId, tenantId),
        eq(domainDocuments.domainId, domainId),
      ),
    );
}

export async function listProcessedDocumentsByDomain(
  db: Db,
  tenantId: string,
  domainId: string,
): Promise<DomainDocument[]> {
  return db
    .select()
    .from(domainDocuments)
    .where(
      and(
        eq(domainDocuments.tenantId, tenantId),
        eq(domainDocuments.domainId, domainId),
        eq(domainDocuments.processingStatus, "PROCESSED"),
      ),
    );
}

import type { ReviewInsert } from "@/lib/review/record";

export type StoryReview = typeof storyReviews.$inferSelect;
export type KpiReviewRow = {
  storyId: string;
  firstSubmissionScore: number;
  finalScore: number;
  weaknesses: string[];
  createdAt: string;
};

export async function createReview(
  db: Db,
  tenantId: string,
  ctx: { storyId: string; projectId: string; domainId: string; userId: string },
  insert: ReviewInsert,
): Promise<StoryReview> {
  const [row] = await db
    .insert(storyReviews)
    .values({ tenantId, ...ctx, ...insert })
    .returning();
  return row;
}

export async function getFirstReviewScoreForStory(
  db: Db,
  tenantId: string,
  storyId: string,
): Promise<number | null> {
  const rows = await db
    .select({ score: storyReviews.firstSubmissionScore })
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.storyId, storyId)))
    .orderBy(asc(storyReviews.createdAt))
    .limit(1);
  return rows[0]?.score ?? null;
}

export async function listReviewsForKpi(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<KpiReviewRow[]> {
  const rows = await db
    .select({
      storyId: storyReviews.storyId,
      firstSubmissionScore: storyReviews.firstSubmissionScore,
      finalScore: storyReviews.finalScore,
      weaknesses: storyReviews.weaknesses,
      createdAt: storyReviews.createdAt,
    })
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.userId, userId)))
    .orderBy(desc(storyReviews.createdAt));
  return rows.map((r) => ({
    storyId: r.storyId,
    firstSubmissionScore: r.firstSubmissionScore,
    finalScore: r.finalScore,
    weaknesses: Array.isArray(r.weaknesses) ? (r.weaknesses as string[]) : [],
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getLatestReviewForStory(
  db: Db,
  tenantId: string,
  storyId: string,
): Promise<StoryReview | undefined> {
  const rows = await db
    .select()
    .from(storyReviews)
    .where(and(eq(storyReviews.tenantId, tenantId), eq(storyReviews.storyId, storyId)))
    .orderBy(desc(storyReviews.createdAt))
    .limit(1);
  return rows[0];
}

export async function setStoryStatus(
  db: Db,
  tenantId: string,
  storyId: string,
  status: string,
): Promise<void> {
  await db
    .update(userStories)
    .set({ status })
    .where(and(eq(userStories.tenantId, tenantId), eq(userStories.id, storyId)));
}
