import { can, type Action, type Role } from "@/lib/rbac";

// Renders children only when the role may perform the action. Cosmetic only —
// the server action re-checks permission; this just hides UI the user can't use.
export function PermissionGate({
  role,
  action,
  children,
}: {
  role: Role;
  action: Action;
  children: React.ReactNode;
}) {
  if (!can(role, action)) return null;
  return <>{children}</>;
}
