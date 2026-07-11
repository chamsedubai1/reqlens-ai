import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects } from "@/lib/db/queries";
import { createProjectAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";
import { Card, PageHeader, FormError, inputClass, btnPrimary } from "@/components/ui";
import { FolderIcon, ChevronRightIcon } from "@/components/icons";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const projects = await listProjects(getDb(), profile.tenantId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Projects" subtitle="Group your user stories by initiative." />
      <FormError message={error} />

      <PermissionGate role={profile.role} action="create_project">
        <Card className="p-4">
          <form action={createProjectAction} className="flex flex-wrap items-center gap-3">
            <input name="name" required placeholder="Project name" className={`${inputClass} sm:w-56`} />
            <input name="description" placeholder="Description (optional)" className={`${inputClass} grow`} />
            <button type="submit" className={btnPrimary}>Create project</button>
          </form>
        </Card>
      </PermissionGate>

      {projects.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">No projects yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="flex items-start gap-4 p-5 transition group-hover:shadow-card">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand">
                  <FolderIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-semibold text-ink">{p.name}</div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand" />
                  </div>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
