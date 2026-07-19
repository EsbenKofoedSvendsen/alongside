import { getDb } from "./db";

/**
 * Digest assembly service: queries the day's notes, shared alerts, and
 * playbook activity for an elder and drafts the end-of-day family update.
 * The caregiver always reviews and edits before anything is sent —
 * nothing reaches the family in their name without approval.
 */

export type DigestSourceData = {
  notes: Array<{ category: string; content: string; created_at: string }>;
  sharedAlerts: Array<{ severity: string; title: string; detail: string }>;
  playbookRuns: Array<{ title: string; status: string }>;
  conversationCount: number;
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function gatherDigestData(elderId: number, caregiverId: number): DigestSourceData {
  const db = getDb();
  const today = todayISO();

  const notes = db
    .prepare(
      "SELECT category, content, created_at FROM notes WHERE elder_id = ? AND shareable = 1 AND date(created_at) = ? ORDER BY created_at"
    )
    .all(elderId, today) as DigestSourceData["notes"];

  const sharedAlerts = db
    .prepare(
      "SELECT severity, title, detail FROM alerts WHERE elder_id = ? AND shared_with_family = 1 AND date(created_at) = ?"
    )
    .all(elderId, today) as DigestSourceData["sharedAlerts"];

  const playbookRuns = db
    .prepare(
      `SELECT p.title, r.status FROM playbook_runs r JOIN playbooks p ON p.id = r.playbook_id
       WHERE r.elder_id = ? AND r.user_id = ? AND date(r.created_at) = ?`
    )
    .all(elderId, caregiverId, today) as DigestSourceData["playbookRuns"];

  const conv = db
    .prepare("SELECT COUNT(*) AS n FROM conversations WHERE elder_id = ? AND user_id = ? AND date(updated_at) = ?")
    .get(elderId, caregiverId, today) as { n: number };

  return { notes, sharedAlerts, playbookRuns, conversationCount: conv.n };
}

export function draftDigest(elderName: string, caregiverName: string, familyName: string, data: DigestSourceData): string {
  const lines: string[] = [];
  const firstName = elderName.split(" ")[0] === "Ibu" || elderName.split(" ")[0] === "Pak"
    ? elderName.split(" ").slice(0, 2).join(" ")
    : elderName.split(" ")[0];

  lines.push(`Hi ${familyName.split(" ")[0]}, here's today's update on ${firstName} 💛`);
  lines.push("");

  const updates = data.notes.filter((n) => n.category === "update");
  const observations = data.notes.filter((n) => n.category === "observation");
  const questions = data.notes.filter((n) => n.category === "question");

  if (updates.length || observations.length) {
    lines.push(`*How the day went*`);
    for (const n of [...updates, ...observations]) lines.push(`• ${n.content}`);
    lines.push("");
  } else {
    lines.push(`*How the day went*`);
    lines.push(`• A calm, steady day — meals, rest, and routine all on track.`);
    lines.push("");
  }

  if (data.sharedAlerts.length) {
    lines.push(`*Things to be aware of*`);
    for (const a of data.sharedAlerts) {
      lines.push(`• ${a.severity === "emergency" ? "🔴" : "🟡"} ${a.title}${a.detail ? ` — ${a.detail}` : ""}`);
    }
    lines.push("");
  }

  if (data.playbookRuns.length) {
    lines.push(`*Care steps taken*`);
    for (const r of data.playbookRuns) {
      lines.push(`• Followed the "${r.title}" care guide${r.status === "resolved" ? " — situation resolved well" : ""}.`);
    }
    lines.push("");
  }

  if (questions.length) {
    lines.push(`*Questions for you / the doctor*`);
    for (const n of questions) lines.push(`• ${n.content}`);
    lines.push("");
  }

  lines.push(`${firstName} is settled in for the evening. I'll message right away if anything comes up. — ${caregiverName.split(" ")[0]}`);
  return lines.join("\n");
}
