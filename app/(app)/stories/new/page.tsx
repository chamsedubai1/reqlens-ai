import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects, listDomains } from "@/lib/db/queries";
import { createStoryAction } from "@/app/actions/features";

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

  const field = "w-full rounded-md border border-slate-300 px-3 py-2";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New User Story</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {(projects.length === 0 || domains.length === 0) && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You need at least one project and one business domain first.
        </p>
      )}
      <form action={createStoryAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Project
            <select name="projectId" required className={field}>
              <option value="">Select…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Business Domain
            <select name="domainId" required className={field}>
              <option value="">Select…</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <input name="title" required placeholder="Story title" className={field} />
        <input name="userRole" required placeholder="User role (e.g. Retail banking customer)" className={field} />
        <textarea name="goal" required rows={2} placeholder="Goal — I want to…" className={field} />
        <textarea name="businessValue" required rows={2} placeholder="Business value — so that…" className={field} />
        <textarea name="description" required rows={3} placeholder="Description" className={field} />
        <textarea name="acceptanceCriteria" rows={3} placeholder="Acceptance criteria (optional)" className={field} />
        <textarea name="businessRules" rows={2} placeholder="Business rules (optional)" className={field} />
        <textarea name="edgeCases" rows={2} placeholder="Edge cases (optional)" className={field} />
        <button type="submit" className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark">Create story</button>
      </form>
    </div>
  );
}
