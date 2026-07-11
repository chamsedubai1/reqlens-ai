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

// A bcrypt hash of a throwaway value, computed once. Used to equalize the
// timing of the "no such user" path with the "user exists" path so login does
// not leak which emails are registered.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword("timing-equalizer-placeholder");
  }
  return dummyHash;
}

// Returns the profile on a correct email + password for an ACTIVE user, else null.
export async function authenticateUser(
  db: Db,
  email: string,
  password: string,
): Promise<UserProfile | null> {
  const profile = await getUserProfileByEmail(db, email);
  // Deactivated (or unknown) users cannot sign in. Run a comparison anyway so
  // both paths take the same time (prevents user enumeration by response timing).
  if (!profile || profile.status !== "ACTIVE") {
    await verifyPassword(password, await getDummyHash());
    return null;
  }
  const ok = await verifyPassword(password, profile.passwordHash);
  return ok ? profile : null;
}
