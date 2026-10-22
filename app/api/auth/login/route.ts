import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyCredentials,
} from "@/agent/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = email && password ? verifyCredentials(email, password) : null;
  if (!user) return Response.json({ ok: false, error: "Invalid email or password." }, { status: 401 });

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${createSessionToken(user)}`,
      "Path=/",
      `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
    ].join("; "),
  );
  return response;
}
