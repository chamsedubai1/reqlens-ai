import type { Db } from "@/lib/db/client";
import {
  getStory,
  getDomain,
  listProcessedDocumentsByDomain,
  createReview,
  getFirstReviewScoreForStory,
  setStoryStatus,
} from "@/lib/db/queries";
import { reviewStory } from "@/lib/ai";
import { buildReviewInsert } from "@/lib/review/record";

// Runs the AI review for a story and persists it (tenant-scoped). Throws if the
// story is missing or the AI review fails/returns an invalid structure — callers
// decide how to surface that. Shared by the submit-review and create-and-review
// server actions.
export async function reviewAndPersistStory(
  db: Db,
  tenantId: string,
  userId: string,
  storyId: string,
): Promise<void> {
  const story = await getStory(db, tenantId, storyId);
  if (!story) throw new Error("STORY_NOT_FOUND");

  const domain = await getDomain(db, tenantId, story.domainId);
  const documents = await listProcessedDocumentsByDomain(db, tenantId, story.domainId);

  const review = await reviewStory({
    story: {
      title: story.title,
      userRole: story.userRole,
      goal: story.goal,
      businessValue: story.businessValue,
      description: story.description,
      acceptanceCriteria: story.acceptanceCriteria,
      businessRules: story.businessRules,
      edgeCases: story.edgeCases,
    },
    domain: { name: domain?.name ?? "General", description: domain?.description },
    documents: documents.map((d) => ({ title: d.title, contentText: d.contentText ?? "" })),
  });

  const previousFirst = await getFirstReviewScoreForStory(db, tenantId, storyId);
  await createReview(
    db,
    tenantId,
    { storyId, projectId: story.projectId, domainId: story.domainId, userId },
    buildReviewInsert(review, previousFirst),
  );
  await setStoryStatus(db, tenantId, storyId, "REVIEWED");
}
