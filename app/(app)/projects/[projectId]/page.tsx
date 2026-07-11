import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getProject, listStoriesByProject } from "@/lib/db/queries";
import { Card, PageHeader, Badge, btnPrimary } from "@/components/ui";
import { FileTextIcon, PlusIcon } from "@/components/icons";
import { storyRef } from "@/lib/story-ref";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={project.name}
        subtitle={project.description ?? undefined}
        action={
          <Link href="/stories/new" className={btnPrimary}>
            <PlusIcon className="h-4 w-4" /> New Story
          </Link>
        }
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Stories</h2>
        {stories.length === 0 ? (
          <Card className="p-10 text-center text-slate-500">No stories in this project yet.</Card>
        ) : (
          <Card className="divide-y divide-slate-50">
            {stories.map((s) => (
              <Link key={s.id} href={`/stories/${s.id}`} className="flex items-center gap-3 p-4 transition hover:bg-slate-50/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileTextIcon className="h-4 w-4" />
                </span>
                <span className="w-20 shrink-0 font-mono text-xs font-semibold text-slate-400">{storyRef(s.reference, s.id, project.name)}</span>
                <span className="flex-1 font-medium text-ink">{s.title}</span>
                <Badge tone={s.status === "REVIEWED" ? "brand" : "slate"}>{s.status}</Badge>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
