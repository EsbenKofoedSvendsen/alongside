import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";

/**
 * The AI Care Copilot engine.
 *
 * Safety pipeline (runs identically with or without an LLM):
 *   1. Escalation classifier — emergency-category input gets an escalation
 *      template, never generated advice, and files an alert.
 *   2. Playbook matcher — trigger keywords surface a condition-specific
 *      playbook offer mid-conversation.
 *   3. Contraindication resolver — elder profile vs playbook steps.
 *   4. Personalized generation — Claude when ANTHROPIC_API_KEY is set,
 *      deterministic guidance engine otherwise (demo mode).
 */

export type ElderContext = {
  id: number;
  name: string;
  age: number | null;
  conditions: string[];
  care_needs: string;
  routine: string;
  bio: string;
  prefs: {
    favorite_foods: string;
    music: string;
    hobbies: string;
    routines: string;
    dislikes: string;
    calming_strategies: string;
    mobility_limits: string;
    communication_style: string;
    dietary_restrictions: string;
  };
};

export type PlaybookRow = {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  triggers: string;
  steps: string;
  contraindications: string;
  reviewed_by: string;
  version: string;
};

export type EngineResult =
  | { kind: "escalation"; content: string; alertTitle: string; severity: "emergency" }
  | { kind: "warning"; content: string; alertTitle: string; severity: "warning" }
  | { kind: "playbook_offer"; content: string; playbook: PlaybookRow }
  | { kind: "text"; content: string };

// ---------------------------------------------------------------------------
// 1. Escalation classifier — rules run BEFORE any generation, always.
// ---------------------------------------------------------------------------

const EMERGENCY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(not|isn'?t|stopped)\s+breathing|can'?t\s+breathe|turning blue|no pulse/i, label: "Breathing emergency" },
  { re: /unconscious|unresponsive|won'?t wake|passed out|collapsed/i, label: "Unresponsive" },
  { re: /chest (pain|tight|pressure)|heart attack/i, label: "Possible cardiac event" },
  { re: /stroke|face droop|slurr(ed|ing)|arm weak|one side (weak|numb)/i, label: "Possible stroke" },
  { re: /choking(?! risk)|something stuck in (her|his|their) throat/i, label: "Choking" },
  { re: /(bleeding (a lot|heavily|won'?t stop))|(blood (everywhere|won'?t stop))/i, label: "Severe bleeding" },
  { re: /seizure|convuls/i, label: "Seizure" },
  { re: /(hit|struck) (her|his|their) head.*(vomit|sleep|drowsy|confus)|head injury/i, label: "Head injury with red flags" },
  { re: /(swallowed|took|drank).*(too many|overdose|whole bottle|all (her|his|their) pills)/i, label: "Possible overdose" },
  { re: /(fell|fall).*(can'?t (get up|move)|screaming|bone|deformed)/i, label: "Fall with possible fracture" },
];

const WARNING_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /fever.*(high|39|40|103|104)|shaking chills/i, label: "High fever" },
  { re: /(hasn'?t|not) (eaten|eating).*(two|2|three|3|days)/i, label: "Multiple days not eating" },
  { re: /(hasn'?t|not) (peed|urinated|passed urine).*(day|24)/i, label: "No urination" },
  { re: /blood in (stool|urine|vomit)/i, label: "Blood present" },
  { re: /new (swelling|rash).*(face|leg|spreading)|leg swollen/i, label: "New swelling" },
  { re: /missed.*(insulin|heart|blood pressure).*(dose|medicine|medication)|missed (two|2|several) doses/i, label: "Missed critical medication" },
];

export function classifyEscalation(text: string): { severity: "emergency" | "warning"; label: string } | null {
  for (const p of EMERGENCY_PATTERNS) if (p.re.test(text)) return { severity: "emergency", label: p.label };
  for (const p of WARNING_PATTERNS) if (p.re.test(text)) return { severity: "warning", label: p.label };
  return null;
}

function escalationTemplate(label: string, elderName: string): string {
  return [
    `**This sounds like it may be an emergency — ${label.toLowerCase()}.**`,
    ``,
    `I'm not going to give AI advice for this. ${elderName} needs a human professional right now:`,
    ``,
    `1. **Call your local emergency number now** (118/119 ambulance in Indonesia, 911 in the US, 112 in the EU).`,
    `2. **Stay with ${elderName}.** Don't give food, drink, or medication unless a dispatcher tells you to.`,
    `3. **Follow the dispatcher's instructions** — they can guide you through first aid step by step.`,
    `4. **Call the family** as soon as ${elderName} is being helped.`,
    ``,
    `I've logged an alert for this. When the situation is under control, come back and tell me what happened so the record is complete.`,
  ].join("\n");
}

function warningTemplate(label: string, elderName: string, guidance: string): string {
  return [
    `**⚠️ I want to flag this: ${label.toLowerCase()} can be serious in elders.**`,
    ``,
    guidance,
    ``,
    `**Please also do this today:** contact ${elderName}'s doctor or clinic and inform the family — don't wait to see if it passes. I've logged an alert you can share with the family in one tap.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 2. Playbook matcher
// ---------------------------------------------------------------------------

export function matchPlaybook(text: string): PlaybookRow | null {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM playbooks").all() as PlaybookRow[];
  const lower = text.toLowerCase();
  for (const row of rows) {
    const triggers = JSON.parse(row.triggers) as string[];
    // A trigger with "+" is a conjunction: every part must appear somewhere
    // in the message ("refus+medic" matches "refusing her medicine").
    const hit = triggers.some((t) =>
      t.includes("+")
        ? t.split("+").every((part) => lower.includes(part.toLowerCase()))
        : lower.includes(t.toLowerCase())
    );
    if (hit) return row;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. Contraindication resolver
// ---------------------------------------------------------------------------

export type PersonalizedStep = { title: string; detail: string; caution?: string; adjusted?: string };

export function personalizeSteps(playbook: PlaybookRow, elder: ElderContext): PersonalizedStep[] {
  const steps = JSON.parse(playbook.steps) as PersonalizedStep[];
  const contras = JSON.parse(playbook.contraindications) as Array<{ ifProfileHas: string; note: string }>;
  const profileText = [
    elder.conditions.join(" "),
    elder.care_needs,
    elder.prefs.dietary_restrictions,
    elder.prefs.mobility_limits,
  ]
    .join(" ")
    .toLowerCase();

  const applicable = contras.filter((c) => profileText.includes(c.ifProfileHas.toLowerCase()));
  if (applicable.length === 0) return steps;

  // Attach each applicable contraindication note to the most relevant step
  // (fallback: first step), tagged so the UI can show "adjusted for [elder]".
  return steps.map((s, i) => {
    const note = applicable
      .map((c) => c.note)
      .filter((n) => i === 0 || stepMentions(s, n))
      .join(" ");
    if (i === 0 && note) return { ...s, adjusted: applicable.map((c) => c.note).join(" ") };
    return s;
  });
}

function stepMentions(step: PersonalizedStep, note: string): boolean {
  const words = note.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
  const text = `${step.title} ${step.detail}`.toLowerCase();
  return words.some((w) => text.includes(w));
}

// ---------------------------------------------------------------------------
// 4a. Deterministic fallback guidance (demo mode, no API key needed)
// ---------------------------------------------------------------------------

type Topic = { re: RegExp; respond: (e: ElderContext) => string };

const TOPICS: Topic[] = [
  {
    re: /eat|food|meal|lunch|dinner|breakfast|cook|snack|makan|appetite/i,
    respond: (e) =>
      [
        `Here's what I'd suggest for ${e.name}'s meal, based on her profile:`,
        ``,
        `- **Lean on her favorites:** ${e.prefs.favorite_foods || "her usual favorites"}.`,
        `- **Respect the restrictions:** ${e.prefs.dietary_restrictions || "no restrictions listed"}.`,
        `- Serve smaller portions more often rather than one big plate — appetite in elders responds better to that.`,
        `- Sit with her if you can. Company is the strongest appetite stimulant there is.`,
        ``,
        `If she refuses the meal entirely or this has been going on for days, tell me — that's a different situation and I'll walk you through it.`,
      ].join("\n"),
  },
  {
    re: /calm|soothe|comfort|anxious|worried|crying|upset|sedih|tenang/i,
    respond: (e) =>
      [
        `When ${e.name} needs calming, start with what her family says works:`,
        ``,
        `- **Her calming strategies:** ${e.prefs.calming_strategies || "gentle voice, familiar topics, and unhurried presence"}.`,
        `- **Avoid her known dislikes:** ${e.prefs.dislikes || "rushing and loud environments"}.`,
        `- Lower the stimulation in the room first — sound, light, number of people — before trying to talk her down.`,
        `- Match her breathing pace, then slow yours. She'll follow you down.`,
        ``,
        `If this becomes agitation or anger, ask me again and I'll bring up the de-escalation playbook.`,
      ].join("\n"),
  },
  {
    re: /sleep|nap|night|insomnia|tidur|awake at night/i,
    respond: (e) =>
      [
        `For sleep trouble with ${e.name}, work the routine before anything else:`,
        ``,
        `- Keep her daily rhythm intact: ${e.prefs.routines || e.routine || "consistent wake, meal, and rest times"}.`,
        `- Morning light and a real daytime activity do more for night sleep than anything you do at 9pm.`,
        `- Cap the afternoon nap at about an hour, and no caffeine after midday.`,
        `- A predictable wind-down — same order, every night — signals sleep the way words can't.`,
        ``,
        `If she's suddenly sleeping much more than usual or is hard to wake, that's a medical flag — tell me and I'll help you escalate it.`,
      ].join("\n"),
  },
  {
    re: /activity|bored|engage|entertain|do today|kegiatan|stimulat/i,
    respond: (e) =>
      [
        `Good instinct — engagement is care. For ${e.name} specifically:`,
        ``,
        `- **Her loves:** ${e.prefs.hobbies || "familiar, hands-on activities"}. Build the day around one of these.`,
        `- **Her music:** ${e.prefs.music || "familiar music from her younger years"} — put it on during a shared task, not as background noise.`,
        `- Keep sessions short (20–30 minutes) and follow her energy. Stopping while it's still fun is the secret.`,
        `- Give her a real role — folding, sorting, tasting, judging your cooking. Purpose beats entertainment.`,
        ``,
        `Note what lands well in her Notes so the whole care circle learns what works.`,
      ].join("\n"),
  },
  {
    re: /bath|shower|wash|hygiene|mandi|refuses to bathe/i,
    respond: (e) =>
      [
        `Bathing is one of the most common friction points — here's what works:`,
        ``,
        `- **Warmth first:** warm the bathroom and the towel before she's in there. ${e.prefs.dislikes?.toLowerCase().includes("cold") ? `Her profile specifically says she hates cold showers — make sure the water is properly warm before she touches it.` : `Cold is the #1 reason elders resist bathing.`}`,
        `- Offer choices, not orders: "bath now or after tea?" keeps her in charge.`,
        `- Keep her covered with a towel where you're not washing — dignity drives cooperation.`,
        `- Mind her mobility limits: ${e.prefs.mobility_limits || "use a shower chair and keep one hand free to steady her"}.`,
        ``,
        `If refusal is new and total, something may be wrong (pain, fear, confusion) — tell me more and we'll dig in.`,
      ].join("\n"),
  },
  {
    re: /medicat|medicine|pill|dose|obat|blood pressure|tablet/i,
    respond: (e) =>
      [
        `For ${e.name}'s medication routine:`,
        ``,
        `- Anchor each dose to a fixed daily moment (${e.routine ? "her routine already has good anchors — breakfast and dinner" : "like right after breakfast"}), same time, same place, same cup of water.`,
        `- Watch her actually take it — pocketed or dropped pills are common and invisible.`,
        `- Log anything unusual: skipped dose, new side effect, dizziness. ${e.conditions.some((c) => /hypertension/i.test(c)) ? "With her blood pressure condition, consistency matters more than perfection — but never double a missed dose." : "Never double a missed dose."}`,
        ``,
        `If she's refusing medication, say so — there's a step-by-step playbook for that and I'll walk you through it.`,
      ].join("\n"),
  },
];

function fallbackAnswer(text: string, elder: ElderContext): string {
  for (const t of TOPICS) if (t.re.test(text)) return t.respond(elder);
  return [
    `I'm here to help you care for ${elder.name}. A few things that might be relevant from her profile:`,
    ``,
    `- **Communication:** ${elder.prefs.communication_style || "speak clearly and unhurried"}`,
    `- **What comforts her:** ${elder.prefs.calming_strategies || "familiar topics and gentle presence"}`,
    `- **Today's rhythm:** ${elder.routine || "keep her usual routine steady"}`,
    ``,
    `Could you tell me a bit more about what's happening? The more specific you are — what you see, when it started, what you've tried — the more useful I can be. If anything ever feels like an emergency, call your local emergency number first.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 4b. LLM-powered generation (DeepSeek or Claude, whichever key is configured)
// ---------------------------------------------------------------------------

function buildSystemPrompt(elder: ElderContext, recentNotes: string[]): string {
  return [
    `You are the Alongside AI Care Copilot: a warm, practical elder-care guide for hired caregivers with no formal medical training.`,
    ``,
    `The caregiver is currently caring for this elder:`,
    `Name: ${elder.name}${elder.age ? `, age ${elder.age}` : ""}`,
    `Conditions: ${elder.conditions.join("; ") || "none listed"}`,
    `Care needs: ${elder.care_needs}`,
    `Daily routine: ${elder.routine}`,
    `Favorite foods: ${elder.prefs.favorite_foods}`,
    `Dietary restrictions (never contradict these): ${elder.prefs.dietary_restrictions}`,
    `Music: ${elder.prefs.music}`,
    `Hobbies: ${elder.prefs.hobbies}`,
    `Dislikes: ${elder.prefs.dislikes}`,
    `Calming strategies: ${elder.prefs.calming_strategies}`,
    `Mobility limits: ${elder.prefs.mobility_limits}`,
    `Communication style: ${elder.prefs.communication_style}`,
    recentNotes.length ? `\nRecent caregiver notes:\n${recentNotes.map((n) => `- ${n}`).join("\n")}` : ``,
    ``,
    `Rules:`,
    `- Give short, plain-language answers with concrete steps to try now. Markdown bullets are fine.`,
    `- Personalize to this elder's profile. Never suggest anything that conflicts with her dietary restrictions, conditions, or mobility limits.`,
    `- You are not a doctor and never diagnose or prescribe. For anything that sounds medical-urgent, tell the caregiver to call emergency services or the doctor — do not generate emergency medical instructions.`,
    `- Warm, respectful tone. The caregiver is capable; you make them confident.`,
    `- Keep answers under 200 words.`,
  ].join("\n");
}

/** DeepSeek (OpenAI-compatible chat completions API). */
async function deepseekAnswer(
  text: string,
  elder: ElderContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  recentNotes: string[]
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(elder, recentNotes) },
        ...history.slice(-10),
        { role: "user", content: text },
      ],
      max_tokens: 700,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API error ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || fallbackAnswer(text, elder);
}

async function claudeAnswer(
  text: string,
  elder: ElderContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  recentNotes: string[]
): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: buildSystemPrompt(elder, recentNotes),
    messages: [...history.slice(-10), { role: "user" as const, content: text }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  return textBlocks.map((b) => b.text).join("\n") || fallbackAnswer(text, elder);
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

export async function runCopilot(
  text: string,
  elder: ElderContext,
  opts: {
    history: Array<{ role: "user" | "assistant"; content: string }>;
    recentNotes: string[];
    playbookAlreadyOffered: (slug: string) => boolean;
  }
): Promise<EngineResult> {
  // 1. Escalation first — never generate advice for emergencies.
  const esc = classifyEscalation(text);
  if (esc?.severity === "emergency") {
    return {
      kind: "escalation",
      severity: "emergency",
      alertTitle: esc.label,
      content: escalationTemplate(esc.label, elder.name),
    };
  }

  // 2. Playbook match (before general generation; skip if already offered in this conversation)
  const playbook = matchPlaybook(text);
  if (playbook && !opts.playbookAlreadyOffered(playbook.slug)) {
    return {
      kind: "playbook_offer",
      playbook,
      content: `This sounds like **${playbook.title.toLowerCase()}** — there's a step-by-step playbook for exactly this, reviewed by our clinical panel. Want to walk through it together?`,
    };
  }

  // 3. Warning-tier concerns get guidance + a distinct visual cue + an alert.
  if (esc?.severity === "warning") {
    const guidance = await answer(text, elder, opts);
    return { kind: "warning", severity: "warning", alertTitle: esc.label, content: warningTemplate(esc.label, elder.name, guidance) };
  }

  // 4. Normal personalized guidance.
  return { kind: "text", content: await answer(text, elder, opts) };
}

async function answer(
  text: string,
  elder: ElderContext,
  opts: { history: Array<{ role: "user" | "assistant"; content: string }>; recentNotes: string[] }
): Promise<string> {
  try {
    if (process.env.DEEPSEEK_API_KEY) {
      return await deepseekAnswer(text, elder, opts.history, opts.recentNotes);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return await claudeAnswer(text, elder, opts.history, opts.recentNotes);
    }
  } catch {
    // LLM unavailable — fall through to the deterministic engine
  }
  return fallbackAnswer(text, elder);
}

// ---------------------------------------------------------------------------
// Elder context loader
// ---------------------------------------------------------------------------

export function loadElderContext(elderId: number): ElderContext | null {
  const db = getDb();
  const e = db.prepare("SELECT * FROM elders WHERE id = ?").get(elderId) as
    | { id: number; name: string; age: number | null; conditions: string; care_needs: string; routine: string; bio: string }
    | undefined;
  if (!e) return null;
  const p = (db.prepare("SELECT * FROM elder_preferences WHERE elder_id = ?").get(elderId) ?? {}) as Record<string, string>;
  return {
    id: e.id,
    name: e.name,
    age: e.age,
    conditions: JSON.parse(e.conditions || "[]"),
    care_needs: e.care_needs ?? "",
    routine: e.routine ?? "",
    bio: e.bio ?? "",
    prefs: {
      favorite_foods: p.favorite_foods ?? "",
      music: p.music ?? "",
      hobbies: p.hobbies ?? "",
      routines: p.routines ?? "",
      dislikes: p.dislikes ?? "",
      calming_strategies: p.calming_strategies ?? "",
      mobility_limits: p.mobility_limits ?? "",
      communication_style: p.communication_style ?? "",
      dietary_restrictions: p.dietary_restrictions ?? "",
    },
  };
}
