import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = { userId: string };

const ALG = "HS256";
const EXPIRY = "7d";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(key(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] });
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    // Invalid signature, expired, or malformed — treat all as "no session".
    return null;
  }
}
