import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getProject, listStoriesByProject } from "@/lib/db/queries";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const profile = await requireProfile();
  const db = getDb();
  const project = await getProject(db, profile.tenantId, projectId);
  if (!project) notFound();
  const stories = await listStoriesByProject(db, profile.tenantId, projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.description && <p className="text-slate-600">{project.description}</p>}
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Stories</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {stories.length === 0 && <li className="p-4 text-slate-500">No stories in this project yet.</li>}
          {stories.map((s) => (
            <li key={s.id} className="p-4">
              <a href={`/stories/${s.id}`} className="font-medium text-brand hover:underline">{s.title}</a>
              <span className="ml-2 text-xs text-slate-500">{s.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
