import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getUserProfileById, type UserProfile } from "@/lib/db/queries";
import { verifySessionToken } from "@/lib/auth/session";

export const SESSION_COOKIE = "reqlens_session";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token, getSessionSecret());
  return payload?.userId ?? null;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return (await getUserProfileById(getDb(), userId)) ?? null;
}
