"use client";

import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/admin";
import type { Role } from "@/lib/rbac";
import {
  updateUserRoleAction,
  setUserStatusAction,
  resetUserPasswordAction,
} from "@/app/actions/admin";

// Safe row shape — never includes passwordHash (this renders on the client).
export type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string; // ISO
};

function roleTone(role: string) {
  if (role === "TENANT_ADMIN") return "brand";
  if (role === "VIEWER") return "slate";
  return "green";
}
const smallSelect = "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10";
const smallBtn = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  return (
    <DataTable<UserRow>
      rows={users}
      getRowKey={(u) => u.id}
      initialSortKey="member"
      searchPlaceholder="Search name or email…"
      columns={[
        {
          key: "member",
          header: "Member",
          filterText: (u) => `${u.fullName} ${u.email}`,
          sortValue: (u) => u.fullName,
          render: (u) => (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {u.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div>
                <div className="font-medium text-ink">
                  {u.fullName} {u.id === currentUserId && <span className="text-xs font-normal text-slate-400">(you)</span>}
                </div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
            </div>
          ),
        },
        { key: "role", header: "Role", facet: true, filterText: (u) => ROLE_LABELS[u.role], sortValue: (u) => u.role, render: (u) => <Badge tone={roleTone(u.role)}>{ROLE_LABELS[u.role]}</Badge> },
        { key: "status", header: "Status", facet: true, filterText: (u) => u.status, sortValue: (u) => u.status, render: (u) => <Badge tone={u.status === "ACTIVE" ? "green" : "slate"}>{u.status}</Badge> },
        { key: "joined", header: "Joined", sortValue: (u) => Date.parse(u.createdAt), filterText: (u) => u.createdAt.slice(0, 10), render: (u) => <span className="text-slate-500">{u.createdAt.slice(0, 10)}</span> },
        {
          key: "changeRole",
          header: "Change role",
          sortable: false,
          render: (u) => (
            <form action={updateUserRoleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <select name="role" defaultValue={u.role} className={smallSelect}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button type="submit" className={smallBtn}>Save</button>
            </form>
          ),
        },
        {
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (u) => (
            <div className="flex flex-col gap-2">
              <form action={setUserStatusAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="status" value={u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                <button type="submit" className={u.status === "ACTIVE" ? "rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50" : "rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"}>
                  {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </form>
              <form action={resetUserPasswordAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <input name="password" type="password" required minLength={8} placeholder="New temp password" className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" autoComplete="new-password" />
                <button type="submit" className={smallBtn}>Reset</button>
              </form>
            </div>
          ),
        },
      ]}
    />
  );
}
