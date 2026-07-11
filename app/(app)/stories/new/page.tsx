import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects, listDomains } from "@/lib/db/queries";
import { createStoryAction } from "@/app/actions/features";
import { Card, PageHeader, FormError, inputClass, btnPrimary } from "@/components/ui";
import { SparklesIcon } from "@/components/icons";

function L({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-brand">*</span>}
      </span>
      {children}
    </label>
  );
}

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const [projects, domains] = await Promise.all([
    listProjects(db, profile.tenantId),
    listDomains(db, profile.tenantId),
  ]);
  const missingSetup = projects.length === 0 || domains.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="New User Story" subtitle="Capture the story, then submit it for an AI quality review." />
      <FormError message={error} />

      {missingSetup && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least one <Link href="/projects" className="font-semibold underline">project</Link> and one{" "}
          <Link href="/domains" className="font-semibold underline">business domain</Link> first.
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <form action={createStoryAction} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <L label="Project" required>
              <select name="projectId" required className={inputClass} defaultValue="">
                <option value="" disabled>Select…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </L>
            <L label="Business Domain" required>
              <select name="domainId" required className={inputClass} defaultValue="">
                <option value="" disabled>Select…</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </L>
          </div>

          <L label="Story title" required>
            <input name="title" required placeholder="e.g. Transfer money to a saved beneficiary" className={inputClass} />
          </L>
          <L label="User role" required>
            <input name="userRole" required placeholder="e.g. Retail banking customer" className={inputClass} />
          </L>

          <div className="grid gap-5 sm:grid-cols-2">
            <L label="Goal" required>
              <textarea name="goal" required rows={2} placeholder="I want to…" className={inputClass} />
            </L>
            <L label="Business value" required>
              <textarea name="businessValue" required rows={2} placeholder="so that…" className={inputClass} />
            </L>
          </div>

          <L label="Description" required>
            <textarea name="description" required rows={3} placeholder="Describe the story in more detail" className={inputClass} />
          </L>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Optional — improves the score</div>
            <div className="space-y-3">
              <textarea name="acceptanceCriteria" rows={3} placeholder="Acceptance criteria" className={inputClass} />
              <textarea name="businessRules" rows={2} placeholder="Business rules" className={inputClass} />
              <textarea name="edgeCases" rows={2} placeholder="Edge cases" className={inputClass} />
            </div>
          </div>

          <button type="submit" className={`${btnPrimary} w-full py-3`}>
            <SparklesIcon className="h-4 w-4" /> Create story
          </button>
        </form>
      </Card>
    </div>
  );
}
