import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/stories", "/domains", "/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("reqlens_session")?.value;
  const secret = process.env.SESSION_SECRET;
  const payload = token && secret ? await verifySessionToken(token, secret) : null;
  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/stories/:path*", "/domains/:path*", "/admin/:path*"],
};
