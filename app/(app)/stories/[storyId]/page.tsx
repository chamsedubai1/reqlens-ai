import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getStory, getProject, listReviewsForStory } from "@/lib/db/queries";
import { storyRef } from "@/lib/story-ref";
import { submitStoryForReviewAction } from "@/app/actions/review";
import { ReviewSummary } from "@/components/ReviewSummary";
import { PermissionGate } from "@/components/PermissionGate";
import { Card, Badge, FormError, btnPrimary, readinessTone } from "@/components/ui";
import { clsx } from "@/lib/cx";
import { SparklesIcon } from "@/components/icons";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2.5">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

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
  const [project, reviews] = await Promise.all([
    getProject(db, profile.tenantId, story.projectId),
    listReviewsForStory(db, profile.tenantId, storyId),
  ]);
  const review = reviews[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold text-slate-400">{storyRef(story.reference, story.id, project?.name)}</div>
          <h1 className="mt-1 text-2xl font-bold text-ink">{story.title}</h1>
          <div className="mt-2">
            <Badge tone={story.status === "REVIEWED" ? "brand" : "slate"}>{story.status}</Badge>
          </div>
        </div>
        <PermissionGate role={profile.role} action="submit_review">
          <form action={submitStoryForReviewAction}>
            <input type="hidden" name="storyId" value={storyId} />
            <button type="submit" className={btnPrimary}>
              <SparklesIcon className="h-4 w-4" />
              {review ? "Re-run AI review" : "Submit for AI review"}
            </button>
          </form>
        </PermissionGate>
      </div>

      <FormError message={error} />

      <Card className="p-6">
        <dl className="divide-y divide-slate-50">
          <Row label="As a">{story.userRole}</Row>
          <Row label="I want">{story.goal}</Row>
          <Row label="So that">{story.businessValue}</Row>
          <Row label="Description"><span className="whitespace-pre-wrap">{story.description}</span></Row>
          {story.acceptanceCriteria && (
            <Row label="Acceptance criteria"><span className="whitespace-pre-wrap">{story.acceptanceCriteria}</span></Row>
          )}
          {story.businessRules && (
            <Row label="Business rules"><span className="whitespace-pre-wrap">{story.businessRules}</span></Row>
          )}
          {story.edgeCases && (
            <Row label="Edge cases"><span className="whitespace-pre-wrap">{story.edgeCases}</span></Row>
          )}
        </dl>
      </Card>

      {review ? (
        <ReviewSummary review={review} />
      ) : (
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand">
            <SparklesIcon className="h-6 w-6" />
          </div>
          <p className="mt-3 font-medium text-slate-700">No AI review yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Submit the story to get a quality score and concrete improvements.
          </p>
        </Card>
      )}

      {reviews.length > 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Review history</h2>
          <Card className="divide-y divide-slate-50">
            {reviews.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="text-xs text-slate-400">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                {i === 0 && <Badge tone="brand">Latest</Badge>}
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-slate-500">first <span className="font-semibold text-slate-700">{r.firstSubmissionScore}</span></span>
                  <span className="text-slate-500">final <span className="font-semibold text-slate-700">{r.finalScore}</span></span>
                  <span className={clsx("font-medium", r.improvementGap > 0 ? "text-emerald-600" : "text-slate-500")}>
                    {r.improvementGap > 0 ? `↑ ${r.improvementGap}` : r.improvementGap}
                  </span>
                  <Badge tone={readinessTone(r.readinessStatus)}>{r.readinessStatus}</Badge>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
