import type { Db } from "@/lib/db/client";
import {
  getUserProfileByEmail,
  createUserWithTenant,
  type UserProfile,
} from "@/lib/db/queries";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { AuthSignupInput } from "@/lib/validation";

// Creates a new tenant + its TENANT_ADMIN. Throws Error("EMAIL_TAKEN") if the
// email already belongs to a user.
export async function registerUser(
  db: Db,
  input: AuthSignupInput,
): Promise<{ userId: string; tenantId: string }> {
  const existing = await getUserProfileByEmail(db, input.email);
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }
  const passwordHash = await hashPassword(input.password);
  return createUserWithTenant(db, {
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    tenantName: input.tenantName,
  });
}

// Returns the profile on a correct email + password, otherwise null.
export async function authenticateUser(
  db: Db,
  email: string,
  password: string,
): Promise<UserProfile | null> {
  const profile = await getUserProfileByEmail(db, email);
  if (!profile) return null;
  const ok = await verifyPassword(password, profile.passwordHash);
  return ok ? profile : null;
}
