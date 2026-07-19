"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Markdown } from "@/components/Markdown";
import {
  sendMessageAction,
  acceptPlaybookAction,
  updatePlaybookRunAction,
  loadConversationAction,
  type ChatMessage,
} from "@/lib/actions/chat";
import type { PersonalizedStep } from "@/lib/copilot";

type Props = {
  elderName: string;
  caregiverFirstName: string;
  suggestions: string[];
  conversations: Array<{ id: number; title: string; updated_at: string }>;
};

export function Chat({ elderName, caregiverFirstName, suggestions, conversations }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const elderShort = elderName.split(" ").slice(0, 2).join(" ");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: -Date.now(), role: "user", kind: "text", content: trimmed, meta: {}, created_at: new Date().toISOString() },
    ]);
    startTransition(async () => {
      try {
        const res = await sendMessageAction(conversationId, trimmed);
        setConversationId(res.conversationId);
        setMessages((m) => [...m.filter((x) => x.id > 0), ...res.messages]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: -Date.now(),
            role: "assistant",
            kind: "text",
            content: "Something went wrong on my end — please try that again.",
            meta: {},
            created_at: new Date().toISOString(),
          },
        ]);
      }
    });
  };

  const acceptPlaybook = (slug: string) => {
    if (!conversationId || pending) return;
    startTransition(async () => {
      const msg = await acceptPlaybookAction(conversationId, slug);
      setMessages((m) => [...m, msg]);
    });
  };

  const openConversation = (id: number) => {
    setDrawerOpen(false);
    startTransition(async () => {
      const msgs = await loadConversationAction(id);
      setConversationId(id);
      setMessages(msgs);
    });
  };

  const newConversation = () => {
    setDrawerOpen(false);
    setConversationId(null);
    setMessages([]);
  };

  return (
    <div className="relative flex flex-1 flex-col">
      {/* conversation history toggle */}
      <div className="flex items-center justify-between px-5 pt-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-full bg-card px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft shadow-card"
        >
          🕰 Past conversations
        </button>
        {conversationId && (
          <button
            onClick={newConversation}
            className="rounded-full bg-card px-3.5 py-1.5 text-[12.5px] font-medium text-terra shadow-card"
          >
            + New
          </button>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="fade-up pt-6">
            <div className="mb-3 text-4xl">💬</div>
            <h2 className="font-display text-[24px] leading-tight">
              What&apos;s happening, {caregiverFirstName}?
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Ask me anything about {elderShort}&apos;s care — I know her profile and I&apos;ll keep
              my advice specific to her.
            </p>
            <div className="mt-6 space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-2xl border border-sand bg-card px-4 py-3 text-left text-[14px] text-ink-soft shadow-card transition-colors hover:border-terra hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-faint">
              Alongside gives care guidance, not medical advice.
              <br />
              In an emergency, always call your local emergency number first.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onAcceptPlaybook={acceptPlaybook} pending={pending} />
        ))}

        {pending && (
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-card" style={{ width: "fit-content" }}>
            <span className="typing-dot h-2 w-2 rounded-full bg-ink-faint" />
            <span className="typing-dot h-2 w-2 rounded-full bg-ink-faint" />
            <span className="typing-dot h-2 w-2 rounded-full bg-ink-faint" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="sticky bottom-0 border-t border-sand bg-cream px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={`Ask about ${elderShort}…`}
            className="max-h-28 flex-1 resize-none rounded-2xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terra text-lg text-white shadow-card transition-colors hover:bg-terra-deep disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </form>
      </div>

      {/* history drawer */}
      {drawerOpen && (
        <div className="absolute inset-0 z-30 flex">
          <div className="fade-up w-4/5 max-w-xs overflow-y-auto bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg">Conversations</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-ink-faint">
                ✕
              </button>
            </div>
            <button
              onClick={newConversation}
              className="mb-3 w-full rounded-xl bg-terra-soft px-4 py-2.5 text-left text-[14px] font-semibold text-terra-deep"
            >
              + Start new conversation
            </button>
            {conversations.length === 0 && (
              <p className="text-[13px] text-ink-faint">No past conversations yet.</p>
            )}
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-[14px] text-ink-soft hover:bg-cream"
                >
                  <span className="line-clamp-1">{c.title}</span>
                  <span className="text-[11px] text-ink-faint">{c.updated_at.slice(0, 16).replace("T", " · ")}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            aria-label="Close"
            className="flex-1 bg-ink/30"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MessageBubble({
  m,
  onAcceptPlaybook,
  pending,
}: {
  m: ChatMessage;
  onAcceptPlaybook: (slug: string) => void;
  pending: boolean;
}) {
  if (m.role === "user") {
    return (
      <div className="fade-up flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-terra px-4 py-3 text-[15px] leading-relaxed text-white">
          {m.content}
        </div>
      </div>
    );
  }

  if (m.kind === "escalation") {
    return (
      <div className="fade-up rounded-2xl border-2 border-alert bg-alert-soft p-4 shadow-card">
        <p className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-alert">
          🚨 Emergency guidance
        </p>
        <div className="text-[15px] leading-relaxed text-ink">
          <Markdown text={m.content} />
        </div>
      </div>
    );
  }

  if (m.kind === "warning") {
    return (
      <div className="fade-up rounded-2xl border border-amber bg-amber-soft p-4 shadow-card">
        <p className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber">
          ⚠️ Worth flagging
        </p>
        <div className="text-[15px] leading-relaxed text-ink">
          <Markdown text={m.content} />
        </div>
      </div>
    );
  }

  if (m.kind === "playbook_offer") {
    return (
      <div className="fade-up max-w-[92%] rounded-2xl rounded-tl-md bg-card p-4 shadow-card">
        <div className="text-[15px] leading-relaxed">
          <Markdown text={m.content} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAcceptPlaybook(String(m.meta.slug))}
            disabled={pending}
            className="rounded-xl bg-moss px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            Walk me through it
          </button>
        </div>
      </div>
    );
  }

  if (m.kind === "playbook") {
    return <PlaybookCard m={m} />;
  }

  return (
    <div className="fade-up max-w-[92%] rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-card">
      <div className="text-[15px] leading-relaxed">
        <Markdown text={m.content} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlaybookCard({ m }: { m: ChatMessage }) {
  const steps = (m.meta.steps ?? []) as PersonalizedStep[];
  const runId = m.meta.runId as number;
  const [checked, setChecked] = useState<number[]>([]);
  const [status, setStatus] = useState<"active" | "resolved" | "needs_help">("active");

  const toggle = (i: number) => {
    if (status !== "active") return;
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setChecked(next);
    void updatePlaybookRunAction(runId, next, "active");
  };

  const finish = (s: "resolved" | "needs_help") => {
    setStatus(s);
    void updatePlaybookRunAction(runId, checked, s);
  };

  const done = checked.length;
  const current = steps.findIndex((_, i) => !checked.includes(i));

  return (
    <div className="fade-up overflow-hidden rounded-2xl border border-moss/30 bg-card shadow-card">
      <div className="bg-moss-soft px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-moss">
          📖 Care playbook · {String(m.meta.category ?? "")}
        </p>
        <p className="font-display mt-0.5 text-[18px] leading-snug text-ink">{String(m.meta.title)}</p>
        {m.meta.adjustedFor ? (
          <p className="mt-1 inline-block rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-moss">
            ✦ Adjusted for {String(m.meta.adjustedFor)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1 px-4 py-3">
        {steps.map((s, i) => {
          const isChecked = checked.includes(i);
          const isCurrent = i === current && status === "active";
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                isCurrent ? "bg-terra-soft" : isChecked ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                    isChecked ? "border-moss bg-moss text-white" : "border-ink-faint text-ink-faint"
                  }`}
                >
                  {isChecked ? "✓" : i + 1}
                </span>
                <span>
                  <span className={`block text-[14.5px] font-semibold ${isChecked ? "line-through" : ""}`}>
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-soft">{s.detail}</span>
                  {s.caution && (
                    <span className="mt-1.5 block rounded-lg bg-alert-soft px-2.5 py-1.5 text-[12.5px] font-medium text-alert">
                      ⚠ {s.caution}
                    </span>
                  )}
                  {s.adjusted && (
                    <span className="mt-1.5 block rounded-lg bg-moss-soft px-2.5 py-1.5 text-[12.5px] font-medium text-moss">
                      ✦ For her specifically: {s.adjusted}
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-sand px-4 py-3">
        {status === "active" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-ink-faint">
              {done}/{steps.length} steps
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => finish("needs_help")}
                className="rounded-xl border border-sand px-3 py-2 text-[13px] font-semibold text-ink-soft"
              >
                Need more help
              </button>
              <button
                onClick={() => finish("resolved")}
                className="rounded-xl bg-moss px-3.5 py-2 text-[13px] font-semibold text-white"
              >
                Resolved ✓
              </button>
            </div>
          </div>
        ) : status === "resolved" ? (
          <p className="text-[13.5px] font-semibold text-moss">
            Well done — situation resolved. This will be reflected in today&apos;s digest. 💚
          </p>
        ) : (
          <p className="text-[13.5px] font-medium text-ink-soft">
            Okay — tell me more about what&apos;s happening below, or contact the family/doctor if
            you&apos;re worried. You&apos;re not alone in this.
          </p>
        )}
      </div>

      <p className="border-t border-sand bg-cream px-4 py-2 text-[10.5px] text-ink-faint">
        {String(m.meta.reviewedBy ?? "")}
      </p>
    </div>
  );
}
