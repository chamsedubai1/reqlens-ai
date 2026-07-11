import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { assertCan, type Action } from "@/lib/rbac";
import type { UserProfile } from "@/lib/db/queries";

// Returns the current profile or redirects unauthenticated users to /login.
export async function requireProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

// Returns the current profile only if it may perform `action`; redirects if
// unauthenticated, throws FORBIDDEN if authenticated but not permitted.
export async function requireCan(action: Action): Promise<UserProfile> {
  const profile = await requireProfile();
  assertCan(profile.role, action);
  return profile;
}
