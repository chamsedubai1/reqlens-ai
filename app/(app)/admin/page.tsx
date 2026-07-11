import { getDb } from "@/lib/db/client";
import { requireProfile } from "@/lib/auth/guard";
import { listUsersByTenant } from "@/lib/db/queries";
import {
  createTeamMemberAction,
  updateUserRoleAction,
  setUserStatusAction,
  resetUserPasswordAction,
} from "@/app/actions/admin";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/admin";
import { can } from "@/lib/rbac";
import { Card, PageHeader, Badge, FormError, inputClass, btnPrimary } from "@/components/ui";
import { ShieldCheckIcon, UserIcon, MailIcon, CheckCircleIcon } from "@/components/icons";

function roleTone(role: string) {
  if (role === "TENANT_ADMIN") return "brand";
  if (role === "VIEWER") return "slate";
  return "green";
}

function fmtDate(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

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

  const users = await listUsersByTenant(getDb(), profile.tenantId);

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

      {/* Users table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3 font-semibold">Change role</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === profile.id;
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                          {u.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium text-ink">
                            {u.fullName} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge tone={roleTone(u.role)}>{ROLE_LABELS[u.role]}</Badge></td>
                    <td className="px-5 py-3"><Badge tone={u.status === "ACTIVE" ? "green" : "slate"}>{u.status}</Badge></td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <form action={updateUserRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={u.role} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Save</button>
                      </form>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-2">
                        <form action={setUserStatusAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="status" value={u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                          <button
                            type="submit"
                            className={
                              u.status === "ACTIVE"
                                ? "rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                : "rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                            }
                          >
                            {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <form action={resetUserPasswordAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <input name="password" type="password" required minLength={8} placeholder="New temp password" className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" autoComplete="new-password" />
                          <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
