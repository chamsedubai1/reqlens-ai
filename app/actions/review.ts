"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  getStory, getDomain, listProcessedDocumentsByDomain,
  createReview, getFirstReviewScoreForStory, setStoryStatus,
} from "@/lib/db/queries";
import { reviewStory } from "@/lib/ai";
import { buildReviewInsert } from "@/lib/review/record";

export async function submitStoryForReviewAction(formData: FormData): Promise<void> {
  const profile = await requireCan("submit_review");
  const storyId = String(formData.get("storyId") ?? "");
  const db = getDb();

  const story = await getStory(db, profile.tenantId, storyId);
  if (!story) redirect("/dashboard?error=" + encodeURIComponent("Story not found."));

  const domain = await getDomain(db, profile.tenantId, story.domainId);
  const documents = await listProcessedDocumentsByDomain(db, profile.tenantId, story.domainId);

  try {
    const review = await reviewStory({
      story: {
        title: story.title, userRole: story.userRole, goal: story.goal,
        businessValue: story.businessValue, description: story.description,
        acceptanceCriteria: story.acceptanceCriteria, businessRules: story.businessRules,
        edgeCases: story.edgeCases,
      },
      domain: { name: domain?.name ?? "General", description: domain?.description },
      documents: documents.map((d) => ({ title: d.title, contentText: d.contentText ?? "" })),
    });
    const previousFirst = await getFirstReviewScoreForStory(db, profile.tenantId, storyId);
    await createReview(
      db,
      profile.tenantId,
      { storyId, projectId: story.projectId, domainId: story.domainId, userId: profile.id },
      buildReviewInsert(review, previousFirst),
    );
    await setStoryStatus(db, profile.tenantId, storyId, "REVIEWED");
  } catch {
    redirect(`/stories/${storyId}?error=` + encodeURIComponent("The AI review could not be completed. Please try again."));
  }
  redirect(`/stories/${storyId}`);
}
