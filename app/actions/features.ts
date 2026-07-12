"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  createProject,
  createDomain,
  createDocument,
  createStory,
  updateStory,
  getStory,
  getProject,
  listReviewsForStory,
} from "@/lib/db/queries";
import {
  projectInputSchema,
  domainInputSchema,
  documentInputSchema,
  storyInputSchema,
} from "@/lib/validation";
import { reviewAndPersistStory } from "@/lib/review/run";
import { storyRef } from "@/lib/story-ref";
import type { InlineReviewState } from "@/lib/review/inline";
import { audit } from "@/lib/audit";

function parseStory(formData: FormData) {
  return storyInputSchema.safeParse({
    projectId: formData.get("projectId"),
    domainId: formData.get("domainId"),
    title: formData.get("title"),
    userRole: formData.get("userRole"),
    goal: formData.get("goal"),
    businessValue: formData.get("businessValue"),
    description: formData.get("description"),
    acceptanceCriteria: formData.get("acceptanceCriteria") || undefined,
    businessRules: formData.get("businessRules") || undefined,
    edgeCases: formData.get("edgeCases") || undefined,
  });
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_project");
  const parsed = projectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect("/projects?error=" + encodeURIComponent("A project name is required."));
  }
  const project = await createProject(getDb(), profile.tenantId, profile.id, parsed.data);
  await audit(profile.tenantId, profile.id, "project.created", "project", project.id, { name: project.name });
  redirect("/projects");
}

export async function createDomainAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_domain");
  const parsed = domainInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect("/domains?error=" + encodeURIComponent("A domain name is required."));
  }
  const domain = await createDomain(getDb(), profile.tenantId, profile.id, parsed.data);
  await audit(profile.tenantId, profile.id, "domain.created", "business_domain", domain.id, { name: domain.name });
  redirect("/domains");
}

export async function createDocumentAction(formData: FormData): Promise<void> {
  const profile = await requireCan("upload_document");
  const domainId = String(formData.get("domainId") ?? "");
  const file = formData.get("file");
  let contentText = String(formData.get("contentText") ?? "");
  let fileName: string | undefined;
  let fileType: string | undefined;

  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".md")) {
      redirect(`/domains/${domainId}?error=` + encodeURIComponent("Only .txt or .md files are supported."));
    }
    contentText = await file.text();
    fileName = file.name;
    fileType = file.type || (name.endsWith(".md") ? "text/markdown" : "text/plain");
  }

  const parsed = documentInputSchema.safeParse({
    title: formData.get("title"),
    contentText,
    fileName,
    fileType,
  });
  if (!parsed.success) {
    redirect(`/domains/${domainId}?error=` + encodeURIComponent("A title and document text are required."));
  }
  const doc = await createDocument(getDb(), profile.tenantId, profile.id, {
    domainId,
    ...parsed.data,
  });
  await audit(profile.tenantId, profile.id, "document.uploaded", "domain_document", doc.id, { title: doc.title, domainId });
  redirect(`/domains/${domainId}`);
}

export async function createStoryAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_story");
  const parsed = parseStory(formData);
  if (!parsed.success) {
    redirect("/stories/new?error=" + encodeURIComponent("Please fill in all required fields."));
  }
  const story = await createStory(getDb(), profile.tenantId, profile.id, parsed.data);
  await audit(profile.tenantId, profile.id, "story.created", "user_story", story.id, { title: story.title });
  redirect(`/stories/${story.id}`);
}

// Save the story and immediately run the AI review, landing on the story with
// its review already shown. (create_story and submit_review share the same role
// set, so one permission check covers both.)
export async function createAndReviewStoryAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_story");
  const parsed = parseStory(formData);
  if (!parsed.success) {
    redirect("/stories/new?error=" + encodeURIComponent("Please fill in all required fields."));
  }
  const db = getDb();
  const story = await createStory(db, profile.tenantId, profile.id, parsed.data);
  await audit(profile.tenantId, profile.id, "story.created", "user_story", story.id, { title: story.title });
  try {
    await reviewAndPersistStory(db, profile.tenantId, profile.id, story.id);
    await audit(profile.tenantId, profile.id, "story.reviewed", "user_story", story.id, {});
  } catch {
    redirect(
      `/stories/${story.id}?error=` +
        encodeURIComponent("Story saved, but the AI review could not be completed. Try again from the story page."),
    );
  }
  redirect(`/stories/${story.id}`);
}

// Inline variant used by the New Story page: creates (or updates, on re-review)
// the story, optionally runs the AI review, and RETURNS the result to render in
// place — no redirect. Signature matches React's useActionState.
export async function reviewStoryInlineAction(
  _prev: InlineReviewState | null,
  formData: FormData,
): Promise<InlineReviewState> {
  const profile = await requireCan("create_story");
  const parsed = parseStory(formData);
  if (!parsed.success) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  const db = getDb();
  const intent = String(formData.get("intent") ?? "review");
  const existingId = String(formData.get("storyId") ?? "").trim();

  let story;
  if (existingId && (await getStory(db, profile.tenantId, existingId))) {
    story = await updateStory(db, profile.tenantId, existingId, parsed.data);
    await audit(profile.tenantId, profile.id, "story.updated", "user_story", existingId, { title: parsed.data.title });
  } else {
    story = await createStory(db, profile.tenantId, profile.id, parsed.data);
    await audit(profile.tenantId, profile.id, "story.created", "user_story", story.id, { title: story.title });
  }
  if (!story) return { ok: false, error: "Could not save the story. Please try again." };

  const project = await getProject(db, profile.tenantId, story.projectId);
  const ref = storyRef(story.reference, story.id, project?.name);

  if (intent !== "review") {
    return { ok: true, mode: "saved", storyId: story.id, storyRef: ref };
  }

  try {
    await reviewAndPersistStory(db, profile.tenantId, profile.id, story.id);
    await audit(profile.tenantId, profile.id, "story.reviewed", "user_story", story.id, {});
  } catch {
    return {
      ok: false,
      mode: "saved",
      storyId: story.id,
      storyRef: ref,
      error: "Story saved, but the AI review could not be completed. Please try again in a moment.",
    };
  }

  const reviews = await listReviewsForStory(db, profile.tenantId, story.id);
  return { ok: true, mode: "reviewed", storyId: story.id, storyRef: ref, review: reviews[0] };
}
