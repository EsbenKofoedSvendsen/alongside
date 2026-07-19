import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getDb } from "./db";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "alongside-pilot-secret-change-in-production"
);
const COOKIE_NAME = "alongside_session";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "caregiver" | "ops";
  onboarded_at: string | null;
};

export async function createSession(userId: number) {
  const db = getDb();
  const sid = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (id, user_id) VALUES (?,?)").run(sid, userId);

  const jwt = await new SignJWT({ sid, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      // Revoke server-side so the token is dead even if the cookie survives
      getDb().prepare("DELETE FROM sessions WHERE id = ?").run(payload.sid as string);
    } catch {
      // token already invalid — nothing to revoke
    }
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const db = getDb();
    // Server-side revocation check. On Vercel the sessions table lives in
    // per-instance ephemeral storage, so there the (signed, 30-day) JWT is
    // authoritative on its own.
    if (!process.env.VERCEL) {
      const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(payload.sid as string);
      if (!session) return null; // revoked
    }
    const user = db
      .prepare("SELECT id, email, name, role, onboarded_at FROM users WHERE id = ?")
      .get(payload.uid as number) as SessionUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

// --- Login rate limiting (brute-force protection, per backlog) -------------
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): { ok: boolean; retryMinutes?: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, retryMinutes: Math.ceil((entry.firstAt + WINDOW_MS - now) / 60000) };
  }
  return { ok: true };
}

export function clearRateLimit(key: string) {
  attempts.delete(key);
}
