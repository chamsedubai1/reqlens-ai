"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { registerUser, authenticateUser } from "@/lib/auth/service";
import { authSignupSchema, authLoginSchema } from "@/lib/validation";
import { createSessionToken } from "@/lib/auth/session";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionSecret,
} from "@/lib/auth/current-user";

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = authSignupSchema.safeParse({
    fullName: formData.get("fullName"),
    tenantName: formData.get("tenantName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/signup?error=" + encodeURIComponent("Please check your details and try again."));
  }
  try {
    const { userId } = await registerUser(getDb(), parsed.data);
    const token = await createSessionToken({ userId }, getSessionSecret());
    await setSessionCookie(token);
  } catch (err) {
    const message =
      err instanceof Error && err.message === "EMAIL_TAKEN"
        ? "That email is already registered."
        : "Could not create your account. Please try again.";
    redirect("/signup?error=" + encodeURIComponent(message));
  }
  redirect("/dashboard");
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = authLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?error=" + encodeURIComponent("Please enter your email and password."));
  }
  const profile = await authenticateUser(
    getDb(),
    parsed.data.email,
    parsed.data.password,
  );
  if (!profile) {
    redirect("/login?error=" + encodeURIComponent("Invalid email or password."));
  }
  const token = await createSessionToken({ userId: profile.id }, getSessionSecret());
  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
