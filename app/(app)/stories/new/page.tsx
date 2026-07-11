import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listProjects, listDomains } from "@/lib/db/queries";
import { NewStoryView } from "@/components/story/NewStoryView";

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

  return (
    <NewStoryView
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      domains={domains.map((d) => ({ id: d.id, name: d.name }))}
      error={error}
    />
  );
}
