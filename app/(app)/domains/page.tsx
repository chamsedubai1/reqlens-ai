import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listDomains } from "@/lib/db/queries";
import { createDomainAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const domains = await listDomains(getDb(), profile.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Business Domains</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="create_domain">
        <form action={createDomainAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="name" required placeholder="Domain name (e.g. Payments)" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="description" placeholder="Description (optional)" className="grow rounded-md border border-slate-300 px-3 py-2" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Create domain</button>
        </form>
      </PermissionGate>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {domains.length === 0 && <li className="p-4 text-slate-500">No domains yet.</li>}
        {domains.map((d) => (
          <li key={d.id} className="p-4">
            <a href={`/domains/${d.id}`} className="font-medium text-brand hover:underline">{d.name}</a>
            {d.description && <p className="text-sm text-slate-600">{d.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
