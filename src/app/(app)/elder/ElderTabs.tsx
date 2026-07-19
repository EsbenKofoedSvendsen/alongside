"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ElderContext } from "@/lib/copilot";
import { updatePreferencesAction, createNoteAction, deleteNoteAction } from "@/lib/actions/care";
import type { NoteRow } from "./page";

const CATEGORY_STYLES: Record<string, { label: string; cls: string }> = {
  question: { label: "❓ Question", cls: "bg-amber-soft text-amber" },
  update: { label: "📝 Update", cls: "bg-moss-soft text-moss" },
  observation: { label: "👀 Observation", cls: "bg-terra-soft text-terra-deep" },
  urgent: { label: "🚨 Urgent", cls: "bg-alert-soft text-alert" },
};

const PREF_SECTIONS: Array<{ key: keyof ElderContext["prefs"]; label: string; icon: string }> = [
  { key: "routines", label: "Routines that matter", icon: "🕰" },
  { key: "favorite_foods", label: "Favorite foods", icon: "🍲" },
  { key: "dietary_restrictions", label: "Dietary restrictions", icon: "⚠️" },
  { key: "music", label: "Music", icon: "🎵" },
  { key: "hobbies", label: "Hobbies & joys", icon: "🌼" },
  { key: "calming_strategies", label: "What calms her", icon: "🕊" },
  { key: "dislikes", label: "Dislikes", icon: "🚫" },
  { key: "mobility_limits", label: "Mobility limits", icon: "🦯" },
  { key: "communication_style", label: "How to communicate", icon: "💬" },
];

export function ElderTabs({
  elder,
  photoEmoji,
  prefsUpdatedAt,
  notes,
  activeTab,
  query,
}: {
  elder: ElderContext;
  photoEmoji: string;
  prefsUpdatedAt: string | null;
  notes: NoteRow[];
  activeTab: "profile" | "notes";
  query: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "notes">(activeTab);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex-1 px-5 py-4 pb-8">
      {/* header card */}
      <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terra-soft text-4xl">
          {photoEmoji}
        </div>
        <div>
          <h1 className="font-display text-[22px] leading-tight">{elder.name}</h1>
          <p className="text-[13px] text-ink-soft">
            {elder.age ? `${elder.age} years old` : ""}
            {elder.conditions.length ? ` · ${elder.conditions.join(" · ")}` : ""}
          </p>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-4 flex rounded-2xl bg-sand p-1">
        {(["profile", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-[14px] font-semibold transition-colors ${
              tab === t ? "bg-card text-ink shadow-card" : "text-ink-faint"
            }`}
          >
            {t === "profile" ? "Preferences" : `Notes (${notes.length})`}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="mt-4">
          {!editing ? (
            <>
              <div className="space-y-3">
                {elder.bio && (
                  <div className="rounded-2xl bg-card p-4 shadow-card">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">About her</p>
                    <p className="mt-1 text-[14.5px] leading-relaxed">{elder.bio}</p>
                  </div>
                )}
                <div className="rounded-2xl bg-card p-4 shadow-card">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">🩺 Care needs</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed">{elder.care_needs || "—"}</p>
                </div>
                <div className="rounded-2xl bg-card p-4 shadow-card">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">📅 Daily routine</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed">{elder.routine || "—"}</p>
                </div>
                {PREF_SECTIONS.map((s) => (
                  <div key={s.key} className="rounded-2xl bg-card p-4 shadow-card">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                      {s.icon} {s.label}
                    </p>
                    <p className="mt-1 text-[14.5px] leading-relaxed">{elder.prefs[s.key] || "—"}</p>
                  </div>
                ))}
              </div>
              {prefsUpdatedAt && (
                <p className="mt-3 text-center text-[12px] text-ink-faint">
                  Last updated {prefsUpdatedAt.slice(0, 16).replace("T", " · ")}
                </p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-4 w-full rounded-2xl border border-terra bg-card px-5 py-3.5 text-[15px] font-semibold text-terra shadow-card"
              >
                ✏️ Update preferences
              </button>
            </>
          ) : (
            <form
              action={(fd) => {
                startTransition(async () => {
                  await updatePreferencesAction(fd);
                  setEditing(false);
                  router.refresh();
                });
              }}
              className="space-y-4"
            >
              {PREF_SECTIONS.map((s) => (
                <label key={s.key} className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                    {s.icon} {s.label}
                  </span>
                  <textarea
                    name={s.key}
                    defaultValue={elder.prefs[s.key]}
                    rows={2}
                    className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[14.5px] focus:border-terra"
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-2xl border border-sand bg-card px-5 py-3.5 text-[15px] font-semibold text-ink-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-2xl bg-terra px-5 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="mt-4">
          <NoteComposer onSaved={() => router.refresh()} />

          <form className="mt-4">
            <input type="hidden" name="tab" value="notes" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search notes…"
              className="w-full rounded-xl border border-sand bg-card px-4 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-terra"
            />
          </form>

          <div className="mt-4 space-y-3">
            {notes.length === 0 && (
              <p className="py-6 text-center text-[14px] text-ink-faint">
                {query ? `No notes match “${query}”.` : "No notes yet — jot the first one above."}
              </p>
            )}
            {notes.map((n) => (
              <div key={n.id} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CATEGORY_STYLES[n.category].cls}`}>
                    {CATEGORY_STYLES[n.category].label}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {n.created_at.slice(0, 16).replace("T", " · ")}
                  </span>
                </div>
                <p className="mt-2 text-[14.5px] leading-relaxed">{n.content}</p>
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-faint">
                  <span>
                    {n.author_name} {n.shareable ? "· shared with family digest" : "· private"}
                  </span>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await deleteNoteAction(n.id);
                        router.refresh();
                      })
                    }
                    className="underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteComposer({ onSaved }: { onSaved: () => void }) {
  const [category, setCategory] = useState<string>("observation");
  const [content, setContent] = useState("");
  const [shareable, setShareable] = useState(true);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        fd.set("category", category);
        fd.set("shareable", shareable ? "on" : "off");
        startTransition(async () => {
          await createNoteAction(fd);
          setContent("");
          onSaved();
        });
      }}
      className="rounded-2xl bg-card p-4 shadow-card"
    >
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_STYLES).map(([key, s]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
              category === key ? s.cls + " ring-1 ring-current" : "bg-cream text-ink-faint"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        required
        placeholder="Jot it down in seconds — it feeds tonight's digest…"
        className="mt-3 w-full rounded-xl border border-sand bg-cream px-4 py-3 text-[14.5px] placeholder:text-ink-faint focus:border-terra"
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={shareable}
            onChange={(e) => setShareable(e.target.checked)}
            className="h-4 w-4 accent-terra"
          />
          Include in family digest
        </label>
        <button
          type="submit"
          disabled={pending || !content.trim()}
          className="rounded-xl bg-terra px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}
