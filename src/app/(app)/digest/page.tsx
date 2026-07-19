import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId, getFamilyContacts } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { todayISO } from "@/lib/digest";
import { DigestEditor } from "./DigestEditor";

export default async function DigestPage() {
  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id)!;
  const db = getDb();
  const today = todayISO();

  const elder = db.prepare("SELECT name FROM elders WHERE id = ?").get(elderId) as { name: string };
  const contacts = getFamilyContacts(elderId).filter((c) => c.is_digest_recipient);

  const todays = db
    .prepare("SELECT * FROM digests WHERE elder_id = ? AND caregiver_id = ? AND digest_date = ?")
    .get(elderId, user.id, today) as
    | { id: number; draft: string; final: string; status: "draft" | "sent" | "failed"; sent_at: string | null }
    | undefined;

  const history = db
    .prepare(
      "SELECT id, digest_date, status, sent_at, final FROM digests WHERE elder_id = ? AND caregiver_id = ? AND digest_date != ? ORDER BY digest_date DESC LIMIT 30"
    )
    .all(elderId, user.id, today) as Array<{
    id: number;
    digest_date: string;
    status: string;
    sent_at: string | null;
    final: string;
  }>;

  return (
    <DigestEditor
      key={todays ? `${todays.id}-${todays.status}` : "none"}
      elderName={elder.name}
      caregiverFirstName={user.name.split(" ")[0]}
      recipients={contacts.map((c) => ({ name: c.name, relationship: c.relationship, channel: c.channel, phone: c.phone }))}
      todays={todays ?? null}
      history={history}
    />
  );
}
