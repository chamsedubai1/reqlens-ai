import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "TENANT_ADMIN",
  "PROJECT_MANAGER",
  "BA_PO",
  "VIEWER",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const businessDomains = pgTable("business_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const domainDocuments = pgTable("domain_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  title: text("title").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  contentText: text("content_text"),
  processingStatus: text("processing_status").notNull().default("PROCESSED"),
  documentSummary: text("document_summary"),
  uploadedBy: uuid("uploaded_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userStories = pgTable("user_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Human-readable per-tenant sequential reference (shown as STORY-<reference>).
  reference: integer("reference"),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  title: text("title").notNull(),
  userRole: text("user_role").notNull(),
  goal: text("goal").notNull(),
  businessValue: text("business_value").notNull(),
  description: text("description").notNull(),
  acceptanceCriteria: text("acceptance_criteria"),
  businessRules: text("business_rules"),
  edgeCases: text("edge_cases"),
  status: text("status").notNull().default("DRAFT"),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const storyReviews = pgTable("story_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => businessDomains.id),
  storyId: uuid("story_id")
    .notNull()
    .references(() => userStories.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id),
  firstSubmissionScore: integer("first_submission_score").notNull(),
  finalScore: integer("final_score").notNull(),
  improvementGap: integer("improvement_gap").notNull(),
  aiDependencyLevel: text("ai_dependency_level").notNull(),
  readinessStatus: text("readiness_status").notNull(),
  roleClarityScore: integer("role_clarity_score"),
  businessValueScore: integer("business_value_score"),
  functionalClarityScore: integer("functional_clarity_score"),
  acceptanceCriteriaScore: integer("acceptance_criteria_score"),
  investScore: integer("invest_score"),
  edgeCaseScore: integer("edge_case_score"),
  testabilityScore: integer("testability_score"),
  domainAlignmentScore: integer("domain_alignment_score"),
  strengths: jsonb("strengths"),
  weaknesses: jsonb("weaknesses"),
  missingDomainRules: jsonb("missing_domain_rules"),
  domainSpecificRisks: jsonb("domain_specific_risks"),
  improvedUserStory: text("improved_user_story"),
  improvedAcceptanceCriteria: jsonb("improved_acceptance_criteria"),
  suggestedBusinessRules: jsonb("suggested_business_rules"),
  suggestedEdgeCases: jsonb("suggested_edge_cases"),
  referencedDocuments: jsonb("referenced_documents"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id").references(() => userProfiles.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
