"use server";

import { getDb } from "../db";
import { getCurrentUser } from "../auth";
import { getCaregiverElderId } from "../queries";
import { loadElderContext, runCopilot, personalizeSteps, type PlaybookRow } from "../copilot";
import { track } from "../track";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  kind: "text" | "playbook_offer" | "playbook" | "escalation" | "warning";
  content: string;
  meta: Record<string, unknown>;
  created_at: string;
};

function rowToMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as number,
    role: r.role as "user" | "assistant",
    kind: r.kind as ChatMessage["kind"],
    content: r.content as string,
    meta: JSON.parse((r.meta as string) || "{}"),
    created_at: r.created_at as string,
  };
}

export async function sendMessageAction(conversationId: number | null, text: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");
  const elder = loadElderContext(elderId)!;
  const db = getDb();

  let convId = conversationId;
  if (!convId) {
    const title = text.length > 46 ? text.slice(0, 45) + "…" : text;
    const conv = db
      .prepare("INSERT INTO conversations (user_id, elder_id, title) VALUES (?,?,?)")
      .run(user.id, elderId, title);
    convId = conv.lastInsertRowid as number;
  } else {
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
  }

  const userMsg = db
    .prepare("INSERT INTO messages (conversation_id, role, kind, content) VALUES (?,?,'text',?)")
    .run(convId, "user", text);
  track(user.id, "copilot_message_sent", { conversation_id: convId });

  const history = (
    db
      .prepare("SELECT role, content FROM messages WHERE conversation_id = ? AND kind IN ('text','warning') ORDER BY id DESC LIMIT 10")
      .all(convId) as Array<{ role: "user" | "assistant"; content: string }>
  ).reverse();

  const recentNotes = (
    db.prepare("SELECT content FROM notes WHERE elder_id = ? ORDER BY id DESC LIMIT 5").all(elderId) as Array<{ content: string }>
  ).map((n) => n.content);

  const offered = new Set(
    (
      db
        .prepare("SELECT meta FROM messages WHERE conversation_id = ? AND kind IN ('playbook_offer','playbook')")
        .all(convId) as Array<{ meta: string }>
    ).map((m) => (JSON.parse(m.meta || "{}") as { slug?: string }).slug ?? "")
  );

  const result = await runCopilot(text, elder, {
    history,
    recentNotes,
    playbookAlreadyOffered: (slug) => offered.has(slug),
  });

  let meta: Record<string, unknown> = {};
  let kind: ChatMessage["kind"] = "text";

  if (result.kind === "escalation" || result.kind === "warning") {
    kind = result.kind;
    const alert = db
      .prepare(
        "INSERT INTO alerts (elder_id, created_by, severity, title, detail, source_message_id) VALUES (?,?,?,?,?,?)"
      )
      .run(elderId, user.id, result.severity, result.alertTitle, text.slice(0, 200), userMsg.lastInsertRowid as number);
    meta = { alertId: alert.lastInsertRowid, alertTitle: result.alertTitle, severity: result.severity };
    track(user.id, "alert_created", { severity: result.severity, title: result.alertTitle });
  } else if (result.kind === "playbook_offer") {
    kind = "playbook_offer";
    meta = { slug: result.playbook.slug, playbookId: result.playbook.id, title: result.playbook.title };
    track(user.id, "playbook_offered", { slug: result.playbook.slug });
  }

  const assistantMsg = db
    .prepare("INSERT INTO messages (conversation_id, role, kind, content, meta) VALUES (?,?,?,?,?)")
    .run(convId, "assistant", kind, result.content, JSON.stringify(meta));

  const rows = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? AND id >= ? ORDER BY id")
    .all(convId, userMsg.lastInsertRowid as number) as Array<Record<string, unknown>>;

  void assistantMsg;
  return { conversationId: convId, messages: rows.map(rowToMessage) };
}

/** Caregiver accepted a playbook offer — render steps personalized to the elder. */
export async function acceptPlaybookAction(conversationId: number, slug: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const elderId = getCaregiverElderId(user.id);
  if (!elderId) throw new Error("No elder assigned");
  const elder = loadElderContext(elderId)!;
  const db = getDb();

  const playbook = db.prepare("SELECT * FROM playbooks WHERE slug = ?").get(slug) as PlaybookRow | undefined;
  if (!playbook) throw new Error("Playbook not found");

  const steps = personalizeSteps(playbook, elder);
  const run = db
    .prepare(
      "INSERT INTO playbook_runs (playbook_id, user_id, elder_id, conversation_id) VALUES (?,?,?,?)"
    )
    .run(playbook.id, user.id, elderId, conversationId);

  const meta = {
    slug: playbook.slug,
    title: playbook.title,
    category: playbook.category,
    reviewedBy: playbook.reviewed_by,
    runId: run.lastInsertRowid,
    steps,
    adjustedFor: steps.some((s) => s.adjusted) ? elder.name : null,
  };

  const msg = db
    .prepare("INSERT INTO messages (conversation_id, role, kind, content, meta) VALUES (?,?,'playbook',?,?)")
    .run(conversationId, "assistant", `Let's take it one step at a time. I'm right here with you.`, JSON.stringify(meta));

  track(user.id, "playbook_accepted", { slug });

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(msg.lastInsertRowid as number) as Record<string, unknown>;
  return rowToMessage(row);
}

export async function updatePlaybookRunAction(runId: number, checkedSteps: number[], status: "active" | "resolved" | "needs_help") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  db.prepare("UPDATE playbook_runs SET checked_steps = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
    .run(JSON.stringify(checkedSteps), status, runId, user.id);
  if (status === "resolved") track(user.id, "playbook_completed", { runId });
  if (status === "needs_help") track(user.id, "playbook_needs_help", { runId });
  return { ok: true };
}

export async function listConversationsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  return db
    .prepare("SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30")
    .all(user.id) as Array<{ id: number; title: string; updated_at: string }>;
}

export async function loadConversationAction(conversationId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  const conv = db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(conversationId, user.id);
  if (!conv) throw new Error("Conversation not found");
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id").all(conversationId) as Array<Record<string, unknown>>;
  return rows.map(rowToMessage);
}
