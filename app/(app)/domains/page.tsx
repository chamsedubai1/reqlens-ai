import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listDomains } from "@/lib/db/queries";
import { createDomainAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";
import { Card, PageHeader, FormError, inputClass, btnPrimary } from "@/components/ui";
import { LayersIcon, ChevronRightIcon } from "@/components/icons";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const domains = await listDomains(getDb(), profile.tenantId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Business Domains"
        subtitle="Give the AI real context — attach reference documents per domain."
      />
      <FormError message={error} />

      <PermissionGate role={profile.role} action="create_domain">
        <Card className="p-4">
          <form action={createDomainAction} className="flex flex-wrap items-center gap-3">
            <input name="name" required placeholder="Domain name (e.g. Payments)" className={`${inputClass} sm:w-64`} />
            <input name="description" placeholder="Description (optional)" className={`${inputClass} grow`} />
            <button type="submit" className={btnPrimary}>Create domain</button>
          </form>
        </Card>
      </PermissionGate>

      {domains.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">No domains yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {domains.map((d) => (
            <Link key={d.id} href={`/domains/${d.id}`} className="group">
              <Card className="flex items-start gap-4 p-5 transition group-hover:shadow-card">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark">
                  <LayersIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-semibold text-ink">{d.name}</div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand" />
                  </div>
                  {d.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{d.description}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
