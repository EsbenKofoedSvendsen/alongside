"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { getCurrentUser } from "../auth";
import { getCaregiverElderId, getFamilyContacts } from "../queries";
import { gatherDigestData, draftDigest, todayISO } from "../digest";
import { track } from "../track";

export async function generateDigestAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");
  const db = getDb();
  const today = todayISO();

  const existing = db
    .prepare("SELECT * FROM digests WHERE elder_id = ? AND caregiver_id = ? AND digest_date = ?")
    .get(elderId, user.id, today) as { id: number; draft: string; status: string } | undefined;
  if (existing && existing.status !== "draft") return { id: existing.id };
  if (existing) return { id: existing.id };

  const elder = db.prepare("SELECT name FROM elders WHERE id = ?").get(elderId) as { name: string };
  const contacts = getFamilyContacts(elderId).filter((c) => c.is_digest_recipient);
  const primary = contacts[0]?.name ?? "family";

  const data = gatherDigestData(elderId, user.id);
  const draft = draftDigest(elder.name, user.name, primary, data);

  const res = db
    .prepare("INSERT INTO digests (elder_id, caregiver_id, digest_date, draft, recipients) VALUES (?,?,?,?,?)")
    .run(elderId, user.id, today, draft, JSON.stringify(contacts.map((c) => ({ name: c.name, channel: c.channel, phone: c.phone }))));

  track(user.id, "digest_generated", { date: today });
  revalidatePath("/digest");
  return { id: res.lastInsertRowid as number };
}

export async function saveDigestDraftAction(digestId: number, text: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  const before = db.prepare("SELECT draft FROM digests WHERE id = ? AND caregiver_id = ?").get(digestId, user.id) as
    | { draft: string }
    | undefined;
  if (!before) throw new Error("Digest not found");
  db.prepare("UPDATE digests SET draft = ? WHERE id = ? AND caregiver_id = ? AND status = 'draft'").run(text, digestId, user.id);
  if (before.draft !== text) track(user.id, "digest_edited", { digestId });
  revalidatePath("/digest");
  return { ok: true };
}

/**
 * Send the digest. Delivery goes through a provider interface; in pilot mode
 * (no WhatsApp Business API credentials) delivery is simulated and marked sent.
 */
export async function sendDigestAction(digestId: number, finalText: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  const digest = db
    .prepare("SELECT * FROM digests WHERE id = ? AND caregiver_id = ? AND status = 'draft'")
    .get(digestId, user.id) as { id: number; recipients: string } | undefined;
  if (!digest) throw new Error("Digest not found or already sent");

  // DeliveryProvider seam: real WhatsApp Business API integration lands here.
  const delivered = await simulateDelivery();

  db.prepare("UPDATE digests SET final = ?, status = ?, sent_at = datetime('now') WHERE id = ?").run(
    finalText,
    delivered ? "sent" : "failed",
    digestId
  );
  track(user.id, delivered ? "digest_sent" : "digest_send_failed", { digestId });
  revalidatePath("/digest");
  return { ok: delivered };
}

async function simulateDelivery(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 600));
  return true;
}

export async function retryDigestAction(digestId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  db.prepare("UPDATE digests SET status = 'draft' WHERE id = ? AND caregiver_id = ? AND status = 'failed'").run(digestId, user.id);
  revalidatePath("/digest");
  return { ok: true };
}
