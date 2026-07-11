import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  tenants,
  userProfiles,
  projects,
  businessDomains,
  userStories,
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
