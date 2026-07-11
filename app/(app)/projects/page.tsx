import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects } from "@/lib/db/queries";
import { createProjectAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const projects = await listProjects(getDb(), profile.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="create_project">
        <form action={createProjectAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input name="name" required placeholder="Project name" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="description" placeholder="Description (optional)" className="grow rounded-md border border-slate-300 px-3 py-2" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Create project</button>
        </form>
      </PermissionGate>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {projects.length === 0 && <li className="p-4 text-slate-500">No projects yet.</li>}
        {projects.map((p) => (
          <li key={p.id} className="p-4">
            <a href={`/projects/${p.id}`} className="font-medium text-brand hover:underline">{p.name}</a>
            {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
