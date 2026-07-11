import { ScoreRing } from "@/components/ScoreRing";
import type { StoryReview } from "@/lib/db/queries";

function List({ title, items }: { title: string; items: unknown }) {
  const arr = Array.isArray(items) ? (items as string[]) : [];
  if (arr.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="ml-4 list-disc text-sm text-slate-600">
        {arr.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export function ReviewSummary({ review }: { review: StoryReview }) {
  return (
    <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-6">
        <ScoreRing score={review.finalScore} />
        <div>
          <div className="text-lg font-semibold text-slate-900">{review.readinessStatus}</div>
          <div className="text-sm text-slate-500">
            Domain alignment: {review.domainAlignmentScore ?? "—"} · AI dependency: {review.aiDependencyLevel}
          </div>
          <p className="mt-1 text-sm text-slate-600">{review.recommendation}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Strengths" items={review.strengths} />
        <List title="Weaknesses" items={review.weaknesses} />
        <List title="Missing domain rules" items={review.missingDomainRules} />
        <List title="Domain-specific risks" items={review.domainSpecificRisks} />
      </div>
      {review.improvedUserStory && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Improved user story</h3>
          <p className="text-sm text-slate-600">{review.improvedUserStory}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Suggested acceptance criteria" items={review.improvedAcceptanceCriteria} />
        <List title="Suggested business rules" items={review.suggestedBusinessRules} />
        <List title="Suggested edge cases" items={review.suggestedEdgeCases} />
        <List title="Referenced documents" items={review.referencedDocuments} />
      </div>
    </div>
  );
}
