import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { loadElderContext } from "@/lib/copilot";
import { ElderTabs } from "./ElderTabs";

export type NoteRow = {
  id: number;
  category: "question" | "update" | "observation" | "urgent";
  content: string;
  shareable: number;
  created_at: string;
  author_name: string;
};

export default async function ElderPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;
  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id)!;
  const elder = loadElderContext(elderId)!;
  const db = getDb();

  const meta = db.prepare("SELECT photo_emoji FROM elders WHERE id = ?").get(elderId) as { photo_emoji: string };
  const updated = db.prepare("SELECT updated_at FROM elder_preferences WHERE elder_id = ?").get(elderId) as
    | { updated_at: string | null }
    | undefined;

  const notes = (
    q
      ? db
          .prepare(
            `SELECT n.*, u.name AS author_name FROM notes n JOIN users u ON u.id = n.author_id
             WHERE n.elder_id = ? AND n.content LIKE ? ORDER BY n.id DESC LIMIT 100`
          )
          .all(elderId, `%${q}%`)
      : db
          .prepare(
            `SELECT n.*, u.name AS author_name FROM notes n JOIN users u ON u.id = n.author_id
             WHERE n.elder_id = ? ORDER BY n.id DESC LIMIT 100`
          )
          .all(elderId)
  ) as NoteRow[];

  return (
    <ElderTabs
      elder={elder}
      photoEmoji={meta.photo_emoji}
      prefsUpdatedAt={updated?.updated_at ?? null}
      notes={notes}
      activeTab={tab === "notes" ? "notes" : "profile"}
      query={q ?? ""}
    />
  );
}
