"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { getCurrentUser } from "../auth";
import { track } from "../track";

export type OpsActionState = { error?: string; ok?: boolean; inviteLink?: string };

/**
 * Internal ops tool: sales/ops enters the elder's profile after talking with
 * the family, and an invitation for the caregiver is created automatically —
 * per the two ops user stories in the MVP backlog. No family-facing app needed.
 */
export async function createElderAction(_prev: OpsActionState, formData: FormData): Promise<OpsActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ops") return { error: "Ops access required." };

  const name = String(formData.get("name") ?? "").trim();
  const age = parseInt(String(formData.get("age") ?? ""), 10);
  const conditions = String(formData.get("conditions") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const inviteeName = String(formData.get("invitee_name") ?? "").trim();
  const familyName = String(formData.get("family_name") ?? "").trim();
  const familyPhone = String(formData.get("family_phone") ?? "").trim();

  if (!name) return { error: "Elder name is required." };
  if (!inviteeName) return { error: "Caregiver name is required — the invitation is created for them." };
  if (!familyName || !familyPhone) return { error: "A family digest contact (name + phone) is required." };

  const db = getDb();
  const elder = db
    .prepare("INSERT INTO elders (name, age, photo_emoji, conditions, care_needs, routine, bio, created_by) VALUES (?,?,?,?,?,?,?,?)")
    .run(
      name,
      Number.isFinite(age) ? age : null,
      String(formData.get("photo_emoji") ?? "🌸") || "🌸",
      JSON.stringify(conditions),
      String(formData.get("care_needs") ?? ""),
      String(formData.get("routine") ?? ""),
      String(formData.get("bio") ?? ""),
      user.id
    );
  const elderId = elder.lastInsertRowid as number;

  db.prepare(
    `INSERT INTO elder_preferences
      (elder_id, favorite_foods, music, hobbies, routines, dislikes, calming_strategies, mobility_limits, communication_style, dietary_restrictions, updated_at, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),?)`
  ).run(
    elderId,
    String(formData.get("favorite_foods") ?? ""),
    String(formData.get("music") ?? ""),
    String(formData.get("hobbies") ?? ""),
    String(formData.get("routines") ?? ""),
    String(formData.get("dislikes") ?? ""),
    String(formData.get("calming_strategies") ?? ""),
    String(formData.get("mobility_limits") ?? ""),
    String(formData.get("communication_style") ?? ""),
    String(formData.get("dietary_restrictions") ?? ""),
    user.id
  );

  db.prepare("INSERT INTO family_contacts (elder_id, name, relationship, channel, phone, is_digest_recipient) VALUES (?,?,?,?,?,1)").run(
    elderId,
    familyName,
    String(formData.get("family_relationship") ?? ""),
    String(formData.get("family_channel") ?? "whatsapp") === "sms" ? "sms" : "whatsapp",
    familyPhone
  );

  // Invitation auto-created on profile submission (backlog user story)
  const token = randomBytes(12).toString("hex");
  db.prepare("INSERT INTO invitations (token, elder_id, invitee_name, created_by) VALUES (?,?,?,?)").run(
    token,
    elderId,
    inviteeName,
    user.id
  );

  track(user.id, "ops_elder_created", { elderId });
  track(user.id, "ops_invitation_created", { elderId });
  revalidatePath("/ops");
  return { ok: true, inviteLink: `/invite/${token}` };
}
