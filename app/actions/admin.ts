"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireCan } from "@/lib/auth/guard";
import {
  getUserProfileByEmail,
  createUserInTenant,
  listUsersByTenant,
  updateUserRole,
} from "@/lib/db/queries";
import { adminCreateUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { isLastAdminDemotion, isRole } from "@/lib/admin";

export async function createTeamMemberAction(formData: FormData): Promise<void> {
  const profile = await requireCan("manage_tenant");
  const parsed = adminCreateUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect("/admin?error=" + encodeURIComponent("Please check the member details (password ≥ 8 chars)."));
  }

  const db = getDb();
  const existing = await getUserProfileByEmail(db, parsed.data.email);
  if (existing) {
    redirect("/admin?error=" + encodeURIComponent("That email is already registered."));
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await createUserInTenant(db, profile.tenantId, {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
  });
  redirect("/admin?ok=" + encodeURIComponent("Team member added."));
}

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const profile = await requireCan("manage_tenant");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) {
    redirect("/admin?error=" + encodeURIComponent("Invalid role."));
  }

  const db = getDb();
  const users = await listUsersByTenant(db, profile.tenantId);
  if (isLastAdminDemotion(users.map((u) => ({ id: u.id, role: u.role })), userId, role)) {
    redirect("/admin?error=" + encodeURIComponent("You can't remove the last admin."));
  }
  await updateUserRole(db, profile.tenantId, userId, role);
  redirect("/admin?ok=" + encodeURIComponent("Role updated."));
}
