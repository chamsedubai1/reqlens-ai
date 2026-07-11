"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  createProject,
  createDomain,
  createDocument,
  createStory,
} from "@/lib/db/queries";
import {
  projectInputSchema,
  domainInputSchema,
  documentInputSchema,
  storyInputSchema,
} from "@/lib/validation";

export async function createProjectAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_project");
  const parsed = projectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect("/projects?error=" + encodeURIComponent("A project name is required."));
  }
  await createProject(getDb(), profile.tenantId, profile.id, parsed.data);
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
  await createDomain(getDb(), profile.tenantId, profile.id, parsed.data);
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
  await createDocument(getDb(), profile.tenantId, profile.id, {
    domainId,
    ...parsed.data,
  });
  redirect(`/domains/${domainId}`);
}

export async function createStoryAction(formData: FormData): Promise<void> {
  const profile = await requireCan("create_story");
  const parsed = storyInputSchema.safeParse({
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
  if (!parsed.success) {
    redirect("/stories/new?error=" + encodeURIComponent("Please fill in all required fields."));
  }
  const story = await createStory(getDb(), profile.tenantId, profile.id, parsed.data);
  redirect(`/stories/${story.id}`);
}
