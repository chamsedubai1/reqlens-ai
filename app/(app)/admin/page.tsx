import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listUsersByTenant, listAuditLogs } from "@/lib/db/queries";
import { createTeamMemberAction } from "@/app/actions/admin";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/admin";
import { can } from "@/lib/rbac";
import { Card, PageHeader, FormError, inputClass, btnPrimary } from "@/components/ui";
import { UsersTable, type UserRow } from "@/components/app/UsersTable";
import { ShieldCheckIcon, UserIcon, MailIcon, CheckCircleIcon } from "@/components/icons";

function fmtDateTime(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

const ACTION_LABELS: Record<string, string> = {
  "project.created": "created a project",
  "domain.created": "created a business domain",
  "document.uploaded": "uploaded a document",
  "story.created": "created a story",
  "story.reviewed": "ran an AI review",
  "user.created": "added a team member",
  "user.role_updated": "changed a member's role",
  "user.status_changed": "changed a member's status",
  "user.password_reset": "reset a member's password",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const profile = await requireProfile();

  if (!can(profile.role, "manage_tenant")) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <p className="mt-3 font-semibold text-ink">Admin access only</p>
          <p className="mt-1 text-sm text-slate-500">
            You need the Tenant Admin role to manage this workspace.
          </p>
        </Card>
      </div>
    );
  }

  const db = getDb();
  const users = await listUsersByTenant(db, profile.tenantId);
  const activity = await listAuditLogs(db, profile.tenantId, 25);

  // Map to a safe client shape — never send passwordHash to the browser.
  const userRows: UserRow[] = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Admin" subtitle="Manage the people in your workspace and their roles." />

      <FormError message={error} />
      {ok && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircleIcon className="h-4 w-4" /> {ok}
        </p>
      )}

      {/* Add team member */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Add a team member</h2>
        <form action={createTeamMemberAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <UserIcon className="h-4 w-4" />
            </span>
            <input name="fullName" required placeholder="Full name" className={`${inputClass} pl-9`} />
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <MailIcon className="h-4 w-4" />
            </span>
            <input name="email" type="email" required placeholder="Email" className={`${inputClass} pl-9`} />
          </div>
          <input name="password" type="password" required minLength={8} placeholder="Temp password" className={inputClass} autoComplete="new-password" />
          <div className="flex gap-2">
            <select name="role" defaultValue="BA_PO" className={inputClass}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button type="submit" className={`${btnPrimary} shrink-0`}>Add</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          The member signs in with this email and temporary password; share it securely.
        </p>
      </Card>

      {/* Users table (sortable + filterable) */}
      <UsersTable users={userRows} currentUserId={profile.id} />

      {/* Recent activity (audit log) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent Activity</h2>
        {activity.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No activity recorded yet.</Card>
        ) : (
          <Card className="divide-y divide-slate-50">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                  {(a.actorName ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="flex-1">
                  <span className="font-medium text-ink">{a.actorName ?? "Someone"}</span>{" "}
                  <span className="text-slate-600">{ACTION_LABELS[a.action] ?? a.action}</span>
                </span>
                <span className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
