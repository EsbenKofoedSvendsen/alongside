"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { getCurrentUser } from "../auth";
import { getCaregiverElderId } from "../queries";
import { track } from "../track";

// --- Elder Preference & Notes ----------------------------------------------

const PREF_FIELDS = [
  "favorite_foods",
  "music",
  "hobbies",
  "routines",
  "dislikes",
  "calming_strategies",
  "mobility_limits",
  "communication_style",
  "dietary_restrictions",
] as const;

export async function updatePreferencesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");

  const db = getDb();
  const sets = PREF_FIELDS.map((f) => `${f} = ?`).join(", ");
  const values = PREF_FIELDS.map((f) => String(formData.get(f) ?? ""));
  db.prepare(`UPDATE elder_preferences SET ${sets}, updated_at = datetime('now'), updated_by = ? WHERE elder_id = ?`).run(
    ...values,
    user.id,
    elderId
  );
  track(user.id, "preferences_updated");
  revalidatePath("/elder");
  return { ok: true };
}

export async function createNoteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");

  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "observation");
  const shareable = formData.get("shareable") !== "off" ? 1 : 0;
  if (!content) return { ok: false };

  getDb()
    .prepare("INSERT INTO notes (elder_id, author_id, category, content, shareable) VALUES (?,?,?,?,?)")
    .run(elderId, user.id, category, content, shareable);
  track(user.id, "note_created", { category });
  revalidatePath("/elder");
  return { ok: true };
}

export async function deleteNoteAction(noteId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  getDb().prepare("DELETE FROM notes WHERE id = ? AND author_id = ?").run(noteId, user.id);
  revalidatePath("/elder");
  return { ok: true };
}

// --- Alerts ------------------------------------------------------------------

export async function shareAlertAction(alertId: number, share: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");
  getDb()
    .prepare("UPDATE alerts SET shared_with_family = ? WHERE id = ? AND elder_id = ?")
    .run(share ? 1 : 0, alertId, elderId);
  track(user.id, share ? "alert_shared" : "alert_unshared", { alertId });
  revalidatePath("/alerts");
  return { ok: true };
}

// --- Onboarding ---------------------------------------------------------------

export async function completeOnboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  const db = getDb();

  // Optional gap-filling observations captured during onboarding
  if (elderId) {
    const additions = String(formData.get("observations") ?? "").trim();
    if (additions) {
      db.prepare("INSERT INTO notes (elder_id, author_id, category, content, shareable) VALUES (?,?,'observation',?,1)").run(
        elderId,
        user.id,
        `From onboarding: ${additions}`
      );
    }
    const calming = String(formData.get("calming") ?? "").trim();
    if (calming) {
      const existing = db.prepare("SELECT calming_strategies FROM elder_preferences WHERE elder_id = ?").get(elderId) as
        | { calming_strategies: string }
        | undefined;
      const merged = existing?.calming_strategies ? `${existing.calming_strategies} ${calming}` : calming;
      db.prepare("UPDATE elder_preferences SET calming_strategies = ?, updated_at = datetime('now'), updated_by = ? WHERE elder_id = ?").run(
        merged,
        user.id,
        elderId
      );
    }
  }

  db.prepare("UPDATE users SET onboarded_at = datetime('now') WHERE id = ?").run(user.id);
  track(user.id, "onboarding_completed");
  return { ok: true };
}

export async function trackOnboardingStepAction(step: string) {
  const user = await getCurrentUser();
  if (user) track(user.id, "onboarding_step_viewed", { step });
  return { ok: true };
}
