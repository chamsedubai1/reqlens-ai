import { ScoreRing } from "@/components/ScoreRing";
import { Badge, readinessTone } from "@/components/ui";
import { clsx } from "@/lib/cx";
import { SCORE_WEIGHTS } from "@/lib/scoring";
import type { StoryReview } from "@/lib/db/queries";
import {
  CheckCircleIcon,
  TargetIcon,
  SparklesIcon,
  FileTextIcon,
} from "@/components/icons";

function toStrings(items: unknown): string[] {
  return Array.isArray(items) ? (items as string[]) : [];
}

function BulletList({
  title,
  items,
  Icon,
  tone,
}: {
  title: string;
  items: unknown;
  Icon: (p: { className?: string }) => React.ReactNode;
  tone: string;
}) {
  const arr = toStrings(items);
  if (arr.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon className={clsx("h-4 w-4", tone)} /> {title}
      </div>
      <ul className="space-y-1.5">
        {arr.map((x, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-600">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function barTone(ratio: number) {
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

export function ReviewSummary({ review }: { review: StoryReview }) {
  const categories = [
    { label: "Role clarity", score: review.roleClarityScore, max: SCORE_WEIGHTS.roleClarity },
    { label: "Business value", score: review.businessValueScore, max: SCORE_WEIGHTS.businessValue },
    { label: "Functional clarity", score: review.functionalClarityScore, max: SCORE_WEIGHTS.functionalClarity },
    { label: "Acceptance criteria", score: review.acceptanceCriteriaScore, max: SCORE_WEIGHTS.acceptanceCriteria },
    { label: "INVEST compliance", score: review.investScore, max: SCORE_WEIGHTS.investCompliance },
    { label: "Edge cases", score: review.edgeCaseScore, max: SCORE_WEIGHTS.edgeCases },
    { label: "Testability", score: review.testabilityScore, max: SCORE_WEIGHTS.testability },
  ];

  return (
    <div className="space-y-6">
      {/* Header: score + status */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={review.finalScore} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge tone={readinessTone(review.readinessStatus)}>{review.readinessStatus}</Badge>
              <span className="text-sm text-slate-500">
                Domain alignment {review.domainAlignmentScore ?? "—"} · AI dependency {review.aiDependencyLevel}
              </span>
            </div>
            <p className="mt-2 text-slate-700">{review.recommendation}</p>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="mt-6 grid gap-x-8 gap-y-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
          {categories.map((c) => {
            const score = c.score ?? 0;
            const ratio = c.max ? score / c.max : 0;
            return (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="font-semibold text-slate-800">{score}<span className="text-slate-400">/{c.max}</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={clsx("h-full rounded-full", barTone(ratio))} style={{ width: `${Math.round(ratio * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Findings */}
      <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:grid-cols-2">
        <BulletList title="Strengths" items={review.strengths} Icon={CheckCircleIcon} tone="text-emerald-500" />
        <BulletList title="Weaknesses" items={review.weaknesses} Icon={TargetIcon} tone="text-amber-500" />
        <BulletList title="Missing domain rules" items={review.missingDomainRules} Icon={TargetIcon} tone="text-red-500" />
        <BulletList title="Domain-specific risks" items={review.domainSpecificRisks} Icon={TargetIcon} tone="text-rose-500" />
      </div>

      {/* Improvements */}
      <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          <SparklesIcon className="h-4 w-4" /> AI Suggestions
        </div>
        {review.improvedUserStory && (
          <div className="rounded-xl bg-brand-50/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Improved user story</div>
            <p className="mt-1 text-sm text-slate-700">{review.improvedUserStory}</p>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <BulletList title="Suggested acceptance criteria" items={review.improvedAcceptanceCriteria} Icon={CheckCircleIcon} tone="text-brand" />
          <BulletList title="Suggested business rules" items={review.suggestedBusinessRules} Icon={CheckCircleIcon} tone="text-brand" />
          <BulletList title="Suggested edge cases" items={review.suggestedEdgeCases} Icon={CheckCircleIcon} tone="text-brand" />
          <BulletList title="Referenced documents" items={review.referencedDocuments} Icon={FileTextIcon} tone="text-slate-400" />
        </div>
      </div>
    </div>
  );
}
