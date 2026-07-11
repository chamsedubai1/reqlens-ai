import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { getDomain, listDocumentsByDomain } from "@/lib/db/queries";
import { createDocumentAction } from "@/app/actions/features";
import { PermissionGate } from "@/components/PermissionGate";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{domain.name}</h1>
        {domain.description && <p className="text-slate-600">{domain.description}</p>}
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <PermissionGate role={profile.role} action="upload_document">
        <form action={createDocumentAction} encType="multipart/form-data" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="domainId" value={domainId} />
          <input name="title" required placeholder="Document title" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <textarea name="contentText" rows={4} placeholder="Paste reference text here..." className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <div className="text-sm text-slate-500">or upload a .txt / .md file:</div>
          <input type="file" name="file" accept=".txt,.md" className="text-sm" />
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Add document</button>
        </form>
      </PermissionGate>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Reference Documents</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {docs.length === 0 && <li className="p-4 text-slate-500">No documents yet. The AI review will use general agile criteria only.</li>}
          {docs.map((d) => (
            <li key={d.id} className="p-4">
              <div className="font-medium text-slate-900">{d.title}</div>
              <div className="text-xs text-slate-500">{d.processingStatus}{d.fileName ? ` · ${d.fileName}` : ""}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
