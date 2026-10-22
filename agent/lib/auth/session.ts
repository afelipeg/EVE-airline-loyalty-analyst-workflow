import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

// Email/password sign-in for the two allowed users, shared by the Next.js app
// (login route, proxy) and the eve channel auth walk. Server-side only.
//
// AUTH_USERS: comma-separated `email:saltHex:scryptHashHex` entries. Passwords
// never live in the repo or the environment in clear text.
// AUTH_SECRET: HMAC key that signs the session cookie.

export const SESSION_COOKIE = "loyalty_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type Session = { readonly email: string; readonly exp: number };

function users(): Map<string, { salt: Buffer; hash: Buffer }> {
  const entries = (process.env.AUTH_USERS ?? "").split(",").filter(Boolean);
  return new Map(
    entries.map((entry) => {
      const [email, salt, hash] = entry.trim().split(":");
      return [email.toLowerCase(), { salt: Buffer.from(salt, "hex"), hash: Buffer.from(hash, "hex") }];
    }),
  );
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Returns the normalized email when the credentials match an allowed user. */
export function verifyCredentials(email: string, password: string): string | null {
  const normalized = email.trim().toLowerCase();
  const user = users().get(normalized);
  if (!user) return null;
  const candidate = scryptSync(password, user.salt, user.hash.length);
  return timingSafeEqual(candidate, user.hash) ? normalized : null;
}

export function createSessionToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS } satisfies Session),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  // A user removed from AUTH_USERS loses access even with a live cookie.
  if (session.exp < Date.now() / 1000 || !users().has(session.email)) return null;
  return session;
}

export function readSessionFromCookieHeader(header: string | null): Session | null {
  const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return readSessionToken(match?.slice(SESSION_COOKIE.length + 1));
}
