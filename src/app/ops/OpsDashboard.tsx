"use client";

import { useActionState, useState } from "react";
import { createElderAction, type OpsActionState } from "@/lib/actions/ops";
import { logoutAction } from "@/lib/actions/auth";

type ElderRow = {
  id: number;
  name: string;
  age: number | null;
  photo_emoji: string;
  invite_token: string | null;
  invite_status: string | null;
  invitee_name: string | null;
  caregiver_name: string | null;
};

const inputCls =
  "w-full rounded-lg border border-sand bg-card px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-terra";
const labelCls = "block text-[12px] font-semibold text-ink-soft mb-1";

export function OpsDashboard({
  opsName,
  elders,
  eventCounts,
  recentEvents,
}: {
  opsName: string;
  elders: ElderRow[];
  eventCounts: Array<{ name: string; n: number }>;
  recentEvents: Array<{ name: string; props: string; created_at: string; user_name: string | null }>;
}) {
  const [tab, setTab] = useState<"roster" | "intake" | "analytics">("roster");
  const [state, formAction, pending] = useActionState<OpsActionState, FormData>(createElderAction, {});
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    void navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl bg-cream px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-terra">Alongside · Internal ops</p>
          <h1 className="font-display text-[26px]">Pilot operations</h1>
          <p className="text-[13px] text-ink-soft">Signed in as {opsName}</p>
        </div>
        <button onClick={() => logoutAction()} className="rounded-xl border border-sand bg-card px-4 py-2 text-[13px] font-semibold text-ink-soft">
          Sign out
        </button>
      </header>

      <div className="mt-6 flex gap-1 rounded-2xl bg-sand p-1">
        {(
          [
            ["roster", `Pilot roster (${elders.length})`],
            ["intake", "+ New elder intake"],
            ["analytics", "Product events"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl py-2 text-[13.5px] font-semibold ${tab === key ? "bg-card shadow-card" : "text-ink-faint"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="mt-5 space-y-3">
          {elders.map((e) => (
            <div key={e.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{e.photo_emoji}</span>
                  <div>
                    <p className="text-[15px] font-semibold">
                      {e.name}
                      {e.age ? `, ${e.age}` : ""}
                    </p>
                    <p className="text-[12.5px] text-ink-soft">
                      {e.caregiver_name
                        ? `Caregiver: ${e.caregiver_name} ✓`
                        : e.invite_status === "pending"
                          ? `Invitation pending${e.invitee_name ? ` → ${e.invitee_name}` : ""}`
                          : "No caregiver linked"}
                    </p>
                  </div>
                </div>
                {e.invite_token && e.invite_status === "pending" && (
                  <button
                    onClick={() => copyLink(e.invite_token!)}
                    className="rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white"
                  >
                    {copied === e.invite_token ? "Copied ✓" : "Copy invite link"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "intake" && (
        <div className="mt-5">
          {state.ok && state.inviteLink ? (
            <div className="rounded-2xl bg-moss-soft p-5 text-moss">
              <p className="text-[16px] font-bold">Elder profile created ✓</p>
              <p className="mt-1 text-[13.5px]">
                The caregiver invitation was generated automatically. Send this link to the
                caregiver via WhatsApp or text:
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-card px-3 py-2 text-[12.5px] text-ink">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  {state.inviteLink}
                </code>
                <button
                  onClick={() => copyLink(state.inviteLink!.replace("/invite/", ""))}
                  className="rounded-lg bg-moss px-3 py-2 text-[12.5px] font-semibold text-white"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <button onClick={() => window.location.reload()} className="mt-4 text-[13px] font-semibold underline">
                Enter another elder
              </button>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              <section className="rounded-2xl bg-card p-4 shadow-card">
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">Elder profile</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Full name *</label>
                    <input name="name" required className={inputCls} placeholder="e.g. Ibu Sri Handayani" />
                  </div>
                  <div>
                    <label className={labelCls}>Age</label>
                    <input name="age" type="number" className={inputCls} placeholder="78" />
                  </div>
                  <div>
                    <label className={labelCls}>Emoji avatar</label>
                    <input name="photo_emoji" className={inputCls} placeholder="🌸" defaultValue="🌸" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Conditions (comma separated)</label>
                    <input name="conditions" className={inputCls} placeholder="Mild dementia, Diabetes type 2" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Care needs</label>
                    <textarea name="care_needs" rows={2} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Daily routine</label>
                    <textarea name="routine" rows={2} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Short bio (who is she/he?)</label>
                    <textarea name="bio" rows={2} className={inputCls} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-card p-4 shadow-card">
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                  Preferences (from the family conversation)
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["favorite_foods", "Favorite foods"],
                      ["dietary_restrictions", "Dietary restrictions"],
                      ["music", "Music"],
                      ["hobbies", "Hobbies"],
                      ["routines", "Routines that matter"],
                      ["dislikes", "Dislikes"],
                      ["calming_strategies", "Calming strategies"],
                      ["mobility_limits", "Mobility limits"],
                    ] as const
                  ).map(([name, label]) => (
                    <div key={name}>
                      <label className={labelCls}>{label}</label>
                      <textarea name={name} rows={2} className={inputCls} />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className={labelCls}>Communication style</label>
                    <input name="communication_style" className={inputCls} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-card p-4 shadow-card">
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                  Family digest contact *
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input name="family_name" required className={inputCls} placeholder="e.g. Maya Santoso" />
                  </div>
                  <div>
                    <label className={labelCls}>Relationship</label>
                    <input name="family_relationship" className={inputCls} placeholder="Daughter" />
                  </div>
                  <div>
                    <label className={labelCls}>Phone *</label>
                    <input name="family_phone" required className={inputCls} placeholder="+62 812…" />
                  </div>
                  <div>
                    <label className={labelCls}>Channel</label>
                    <select name="family_channel" className={inputCls}>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS / text</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-card p-4 shadow-card">
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                  Caregiver invitation (auto-created on save) *
                </h2>
                <label className={labelCls}>Caregiver name *</label>
                <input name="invitee_name" required className={inputCls} placeholder="e.g. Rina Kusuma" />
              </section>

              {state.error && (
                <p className="rounded-xl bg-alert-soft px-4 py-3 text-[14px] text-alert">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-terra px-5 py-4 text-[15px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create elder profile + invitation"}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">Event counts</h2>
            <div className="space-y-1.5">
              {eventCounts.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-[13.5px]">
                  <code className="text-ink-soft">{e.name}</code>
                  <span className="font-bold">{e.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">Latest events</h2>
            <div className="space-y-2">
              {recentEvents.map((e, i) => (
                <div key={i} className="border-b border-sand pb-1.5 text-[12.5px] last:border-0">
                  <code className="font-semibold">{e.name}</code>
                  <span className="text-ink-faint">
                    {" "}
                    · {e.user_name ?? "system"} · {e.created_at.slice(5, 16).replace("T", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
