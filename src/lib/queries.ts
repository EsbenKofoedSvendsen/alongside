import { getDb } from "./db";

/** The elder this caregiver is assigned to (MVP: one elder per caregiver). */
export function getCaregiverElderId(userId: number): number | null {
  const row = getDb()
    .prepare("SELECT elder_id FROM care_circle WHERE user_id = ? LIMIT 1")
    .get(userId) as { elder_id: number } | undefined;
  return row?.elder_id ?? null;
}

export function getFamilyContacts(elderId: number) {
  return getDb()
    .prepare("SELECT * FROM family_contacts WHERE elder_id = ? ORDER BY is_digest_recipient DESC, name")
    .all(elderId) as Array<{
    id: number;
    name: string;
    relationship: string;
    channel: "whatsapp" | "sms";
    phone: string;
    is_digest_recipient: number;
  }>;
}
