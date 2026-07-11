import type { Role } from "@/lib/rbac";

export const ALL_ROLES: Role[] = [
  "TENANT_ADMIN",
  "PROJECT_MANAGER",
  "BA_PO",
  "VIEWER",
];

export const ROLE_LABELS: Record<Role, string> = {
  TENANT_ADMIN: "Tenant Admin",
  PROJECT_MANAGER: "Project Manager",
  BA_PO: "BA / PO",
  VIEWER: "Viewer",
};

export function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}

// True if changing `targetId`'s role to `newRole` would leave the tenant with no
// TENANT_ADMIN. Used to block a workspace from locking itself out.
export function isLastAdminDemotion(
  users: { id: string; role: Role }[],
  targetId: string,
  newRole: Role,
): boolean {
  const target = users.find((u) => u.id === targetId);
  if (!target) return false;
  if (target.role !== "TENANT_ADMIN") return false;
  if (newRole === "TENANT_ADMIN") return false;
  const admins = users.filter((u) => u.role === "TENANT_ADMIN").length;
  return admins <= 1;
}

// True if deactivating `targetId` would leave the tenant with no ACTIVE admin
// (which would lock the workspace out of admin functions).
export function isLastActiveAdminDeactivation(
  users: { id: string; role: Role; status: string }[],
  targetId: string,
): boolean {
  const target = users.find((u) => u.id === targetId);
  if (!target) return false;
  if (target.role !== "TENANT_ADMIN" || target.status !== "ACTIVE") return false;
  const activeAdmins = users.filter(
    (u) => u.role === "TENANT_ADMIN" && u.status === "ACTIVE",
  ).length;
  return activeAdmins <= 1;
}
