import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { OpsDashboard } from "./OpsDashboard";

export default async function OpsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ops") redirect("/copilot");

  const db = getDb();
  const elders = db
    .prepare(
      `SELECT e.id, e.name, e.age, e.photo_emoji,
              i.token AS invite_token, i.status AS invite_status, i.invitee_name,
              (SELECT u.name FROM care_circle cc JOIN users u ON u.id = cc.user_id WHERE cc.elder_id = e.id LIMIT 1) AS caregiver_name
       FROM elders e
       LEFT JOIN invitations i ON i.elder_id = e.id
       ORDER BY e.id DESC`
    )
    .all() as Array<{
    id: number;
    name: string;
    age: number | null;
    photo_emoji: string;
    invite_token: string | null;
    invite_status: string | null;
    invitee_name: string | null;
    caregiver_name: string | null;
  }>;

  const eventCounts = db
    .prepare("SELECT name, COUNT(*) AS n FROM events GROUP BY name ORDER BY n DESC LIMIT 20")
    .all() as Array<{ name: string; n: number }>;

  const recentEvents = db
    .prepare(
      `SELECT ev.name, ev.props, ev.created_at, u.name AS user_name
       FROM events ev LEFT JOIN users u ON u.id = ev.user_id
       ORDER BY ev.id DESC LIMIT 25`
    )
    .all() as Array<{ name: string; props: string; created_at: string; user_name: string | null }>;

  return <OpsDashboard opsName={user.name} elders={elders} eventCounts={eventCounts} recentEvents={recentEvents} />;
}
