export type Role = "TENANT_ADMIN" | "PROJECT_MANAGER" | "BA_PO" | "VIEWER";

export type Action =
  | "manage_tenant"
  | "create_project"
  | "view_project"
  | "create_domain"
  | "upload_document"
  | "create_story"
  | "submit_review"
  | "view_review"
  | "view_personal_dashboard"
  | "view_team_dashboard"
  | "delete_story";

// Permission matrix from the spec (CLAUDE.md section 6 + spec section 4.10).
// Each action lists the roles permitted to perform it.
const PERMISSIONS: Record<Action, Role[]> = {
  manage_tenant: ["TENANT_ADMIN"],
  create_project: ["TENANT_ADMIN", "PROJECT_MANAGER"],
  view_project: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  create_domain: ["TENANT_ADMIN"],
  upload_document: ["TENANT_ADMIN"],
  create_story: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO"],
  submit_review: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO"],
  view_review: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  view_personal_dashboard: ["TENANT_ADMIN", "PROJECT_MANAGER", "BA_PO", "VIEWER"],
  view_team_dashboard: ["TENANT_ADMIN", "PROJECT_MANAGER"],
  delete_story: ["TENANT_ADMIN", "PROJECT_MANAGER"],
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[action].includes(role);
}

// Server-side authorization assertion. Throws Error("FORBIDDEN") when the role
// may not perform the action. Call this in every mutation before writing.
export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error("FORBIDDEN");
  }
}
