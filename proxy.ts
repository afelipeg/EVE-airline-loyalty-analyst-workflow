import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/agent/lib/auth/session";

// Gates every page and app API route behind the sign-in. The eve routes
// (/eve/v1/**) are excluded: on Vercel they reach the eve service before
// Next.js, so agent/channels/eve.ts enforces the same session there.
export function proxy(request: NextRequest) {
  if (readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/auth|eve/|_next/|favicon.ico).*)"],
};
