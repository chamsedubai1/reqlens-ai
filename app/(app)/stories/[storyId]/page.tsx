import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getStory } from "@/lib/db/queries";

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const profile = await requireProfile();
  const story = await getStory(getDb(), profile.tenantId, storyId);
  if (!story) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{story.title}</h1>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{story.status}</span>
      <dl className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <div><dt className="font-medium text-slate-500">As a</dt><dd>{story.userRole}</dd></div>
        <div><dt className="font-medium text-slate-500">I want</dt><dd>{story.goal}</dd></div>
        <div><dt className="font-medium text-slate-500">So that</dt><dd>{story.businessValue}</dd></div>
        <div><dt className="font-medium text-slate-500">Description</dt><dd className="whitespace-pre-wrap">{story.description}</dd></div>
        {story.acceptanceCriteria && <div><dt className="font-medium text-slate-500">Acceptance criteria</dt><dd className="whitespace-pre-wrap">{story.acceptanceCriteria}</dd></div>}
      </dl>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        AI review is added in Plan 4. The “Submit for AI review” action will appear here.
      </div>
    </div>
  );
}
