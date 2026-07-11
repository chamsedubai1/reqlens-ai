import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getDomain, listDocumentsByDomain } from "@/lib/db/queries";
import { createDocumentAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";
import { Card, PageHeader, FormError, Badge, inputClass, btnPrimary } from "@/components/ui";
import { FileTextIcon } from "@/components/icons";

export default async function DomainDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ domainId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { domainId } = await params;
  const { error } = await searchParams;
  const profile = await requireProfile();
  const db = getDb();
  const domain = await getDomain(db, profile.tenantId, domainId);
  if (!domain) notFound();
  const docs = await listDocumentsByDomain(db, profile.tenantId, domainId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={domain.name} subtitle={domain.description ?? undefined} />
      <FormError message={error} />

      <PermissionGate role={profile.role} action="upload_document">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Add a reference document</h2>
          <form action={createDocumentAction} encType="multipart/form-data" className="space-y-3">
            <input type="hidden" name="domainId" value={domainId} />
            <input name="title" required placeholder="Document title" className={inputClass} />
            <textarea name="contentText" rows={4} placeholder="Paste reference text here…" className={inputClass} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm text-slate-500">
                or upload a{" "}
                <span className="font-medium text-slate-700">.txt</span> /{" "}
                <span className="font-medium text-slate-700">.md</span> file:{" "}
                <input type="file" name="file" accept=".txt,.md" className="ml-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand-100" />
              </label>
              <button type="submit" className={btnPrimary}>Add document</button>
            </div>
          </form>
        </Card>
      </PermissionGate>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Reference Documents</h2>
        {docs.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            No documents yet. The AI review will use general agile criteria only.
          </Card>
        ) : (
          <Card className="divide-y divide-slate-50">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <FileTextIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{d.title}</div>
                  {d.fileName && <div className="truncate text-xs text-slate-500">{d.fileName}</div>}
                </div>
                <Badge tone={d.processingStatus === "PROCESSED" ? "green" : "slate"}>{d.processingStatus}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
