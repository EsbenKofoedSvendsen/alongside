"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { createSession, destroySession, getCurrentUser, checkRateLimit, clearRateLimit } from "../auth";
import { track } from "../track";

export type ActionState = { error?: string; ok?: boolean; info?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const terms = formData.get("terms") === "on";

  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!terms) return { error: "Please accept the terms & privacy consent to continue." };

  const db = getDb();
  const invite = db
    .prepare("SELECT * FROM invitations WHERE token = ? AND status = 'pending'")
    .get(token) as { id: number; elder_id: number } | undefined;
  if (!invite) return { error: "This invitation link is no longer valid. Please ask the family or Alongside team for a new one." };

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return { error: "An account with this email already exists. Try logging in instead." };

  const hash = bcrypt.hashSync(password, 10);
  const user = db
    .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?, 'caregiver')")
    .run(email, hash, name);
  const userId = user.lastInsertRowid as number;

  db.prepare("INSERT INTO care_circle (elder_id, user_id) VALUES (?,?)").run(invite.elder_id, userId);
  db.prepare("UPDATE invitations SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(invite.id);

  track(userId, "signup_completed", { via: "invitation" });
  await createSession(userId);
  redirect("/onboarding");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const limit = checkRateLimit(`login:${email}`);
  if (!limit.ok) {
    return { error: `Too many attempts. Please try again in ${limit.retryMinutes} minute${limit.retryMinutes === 1 ? "" : "s"}.` };
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | { id: number; password_hash: string; role: string; onboarded_at: string | null }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { error: "Email or password is incorrect." };
  }

  clearRateLimit(`login:${email}`);
  track(user.id, "login");
  await createSession(user.id);
  if (user.role === "ops") redirect("/ops");
  if (!user.onboarded_at) redirect("/onboarding");
  redirect("/copilot");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) track(user.id, "logout");
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };

  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;

  // Always claim success so we don't leak which emails exist.
  if (!user) return { ok: true, info: "" };

  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?,?,?)").run(token, user.id, expires);
  track(user.id, "password_reset_requested");

  // Pilot mode: no email service is wired up, so the reset link is surfaced
  // directly (in production this is delivered by email).
  return { ok: true, info: `/reset-password?token=${token}` };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const db = getDb();
  const row = db
    .prepare("SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')")
    .get(token) as { user_id: number } | undefined;
  if (!row) return { error: "This reset link is invalid or has expired. Please request a new one." };

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), row.user_id);
  db.prepare("UPDATE password_resets SET used = 1 WHERE token = ?").run(token);
  // Revoke all existing sessions for safety
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
  track(row.user_id, "password_reset_completed");
  return { ok: true };
}
