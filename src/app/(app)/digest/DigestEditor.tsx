"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateDigestAction, saveDigestDraftAction, sendDigestAction } from "@/lib/actions/digest";

type Recipient = { name: string; relationship: string; channel: "whatsapp" | "sms"; phone: string };
type Todays = { id: number; draft: string; final: string; status: "draft" | "sent" | "failed"; sent_at: string | null } | null;

export function DigestEditor({
  elderName,
  caregiverFirstName,
  recipients,
  todays,
  history,
}: {
  elderName: string;
  caregiverFirstName: string;
  recipients: Recipient[];
  todays: Todays;
  history: Array<{ id: number; digest_date: string; status: string; sent_at: string | null; final: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(todays?.draft ?? "");
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const elderShort = elderName.split(" ").slice(0, 2).join(" ");
  const primary = recipients[0];

  const generate = () =>
    startTransition(async () => {
      await generateDigestAction();
      router.refresh();
    });

  const send = () =>
    startTransition(async () => {
      if (!todays) return;
      await saveDigestDraftAction(todays.id, text);
      await sendDigestAction(todays.id, text);
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex-1 px-5 py-4 pb-8">
      <h1 className="font-display text-[24px]">Daily family digest</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        Drafted from what you already logged today. Nothing is sent in your name until you approve
        it.
      </p>

      {recipients.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wa text-lg">
            {primary.channel === "whatsapp" ? "🟢" : "💬"}
          </span>
          <div className="text-[13px] leading-snug">
            <p className="font-semibold">
              To: {recipients.map((r) => `${r.name}${r.relationship ? ` (${r.relationship})` : ""}`).join(", ")}
            </p>
            <p className="text-ink-faint">
              via {primary.channel === "whatsapp" ? "WhatsApp" : "SMS"} · {primary.phone}
            </p>
          </div>
        </div>
      )}

      {/* today's digest states */}
      {!todays && (
        <div className="mt-5 rounded-2xl bg-card p-6 text-center shadow-card">
          <p className="text-3xl">💌</p>
          <p className="mt-2 text-[15.5px] font-semibold">Ready to send today&apos;s update?</p>
          <p className="mx-auto mt-1 max-w-[280px] text-[13.5px] text-ink-soft">
            I&apos;ll draft it from today&apos;s notes, alerts you chose to share, and care steps —
            you review every word first.
          </p>
          <button
            onClick={generate}
            disabled={pending}
            className="mt-4 rounded-2xl bg-terra px-6 py-3.5 text-[15px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-60"
          >
            {pending ? "Drafting…" : "Draft today's digest"}
          </button>
        </div>
      )}

      {todays?.status === "draft" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">
            ✏️ Review &amp; edit — this is your voice, {caregiverFirstName}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            className="w-full rounded-2xl border border-sand bg-card px-4 py-4 text-[14.5px] leading-relaxed shadow-card focus:border-terra"
          />
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={pending || !text.trim()}
              className="mt-3 w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-50"
            >
              Send to family →
            </button>
          ) : (
            <div className="mt-3 rounded-2xl bg-card p-4 shadow-card">
              <p className="text-[14.5px] font-semibold">
                Send this update about {elderShort} to {recipients.map((r) => r.name).join(" & ")}?
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">
                It will arrive on their {primary?.channel === "whatsapp" ? "WhatsApp" : "phone"} in your name.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-xl border border-sand px-4 py-3 text-[14px] font-semibold text-ink-soft"
                >
                  Keep editing
                </button>
                <button
                  onClick={send}
                  disabled={pending}
                  className="flex-1 rounded-xl bg-moss px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Yes, send it"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {todays?.status === "sent" && (
        <div className="mt-5">
          <div className="rounded-2xl bg-moss-soft p-4 text-[14px] font-semibold text-moss">
            ✓ Sent today at {todays.sent_at?.slice(11, 16)} — {recipients[0]?.name.split(" ")[0]} has it.
          </div>
          <WhatsAppPreview text={todays.final || todays.draft} time={todays.sent_at?.slice(11, 16) ?? ""} />
        </div>
      )}

      {/* history */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Past digests</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => setExpanded(expanded === h.id ? null : h.id)}
                className="block w-full rounded-2xl bg-card p-4 text-left shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold">{h.digest_date}</span>
                  <span className={`text-[12px] font-semibold ${h.status === "sent" ? "text-moss" : "text-alert"}`}>
                    {h.status === "sent" ? `✓ sent ${h.sent_at?.slice(11, 16) ?? ""}` : h.status}
                  </span>
                </div>
                {expanded === h.id && (
                  <p className="mt-3 whitespace-pre-wrap border-t border-sand pt-3 text-[13.5px] leading-relaxed text-ink-soft">
                    {h.final}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** WhatsApp-style rendering of the sent digest — what the family actually sees. */
function WhatsAppPreview({ text, time }: { text: string; time: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-[#e5ddd5] p-4">
      <p className="mb-2 text-center text-[11px] font-semibold text-ink-soft">
        How it looks on the family&apos;s WhatsApp
      </p>
      <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-wa px-3.5 py-2.5 shadow-sm">
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{renderWa(text)}</p>
        <p className="mt-1 text-right text-[10.5px] text-ink-faint">{time} ✓✓</p>
      </div>
    </div>
  );
}

function renderWa(text: string): React.ReactNode {
  // WhatsApp uses *bold* — render it
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <strong key={i}>{part.slice(1, -1)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
