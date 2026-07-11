import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getStory, getLatestReviewForStory } from "@/lib/db/queries";
import { submitStoryForReviewAction } from "@/app/actions/review";
import { ReviewSummary } from "@/components/ReviewSummary";
import { PermissionGate } from "@/components/PermissionGate";

export default async function StoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { storyId } = await params;
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const story = await getStory(db, profile.tenantId, storyId);
  if (!story) notFound();
  const review = await getLatestReviewForStory(db, profile.tenantId, storyId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{story.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{story.status}</span>
        </div>
        <PermissionGate role={profile.role} action="submit_review">
          <form action={submitStoryForReviewAction}>
            <input type="hidden" name="storyId" value={storyId} />
            <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
              {review ? "Re-run AI review" : "Submit for AI review"}
            </button>
          </form>
        </PermissionGate>
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <dl className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <div><dt className="font-medium text-slate-500">As a</dt><dd>{story.userRole}</dd></div>
        <div><dt className="font-medium text-slate-500">I want</dt><dd>{story.goal}</dd></div>
        <div><dt className="font-medium text-slate-500">So that</dt><dd>{story.businessValue}</dd></div>
        <div><dt className="font-medium text-slate-500">Description</dt><dd className="whitespace-pre-wrap">{story.description}</dd></div>
        {story.acceptanceCriteria && <div><dt className="font-medium text-slate-500">Acceptance criteria</dt><dd className="whitespace-pre-wrap">{story.acceptanceCriteria}</dd></div>}
      </dl>

      {review ? (
        <ReviewSummary review={review} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No AI review yet. Submit the story to get a quality score and improvements.
        </p>
      )}
    </div>
  );
}
