import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { Chat } from "./Chat";

export default async function CopilotPage() {
  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id)!;
  const db = getDb();
  const elder = db.prepare("SELECT name FROM elders WHERE id = ?").get(elderId) as { name: string };
  const conversations = db
    .prepare("SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30")
    .all(user.id) as Array<{ id: number; title: string; updated_at: string }>;

  const elderShort = elder.name.split(" ").slice(0, 2).join(" ");

  const suggestions = [
    `What should I make ${elderShort} for lunch?`,
    "She seems restless this evening — what can I try?",
    "Ideas to keep her engaged this afternoon?",
    "She's refusing her blood pressure medicine",
    "How do I help her bathe without a fight?",
  ];

  return (
    <Chat
      elderName={elder.name}
      caregiverFirstName={user.name.split(" ")[0]}
      suggestions={suggestions}
      conversations={conversations}
    />
  );
}
