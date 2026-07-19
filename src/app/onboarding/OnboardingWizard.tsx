"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ElderContext } from "@/lib/copilot";
import { completeOnboardingAction, trackOnboardingStepAction } from "@/lib/actions/care";

type Props = { caregiverName: string; elder: ElderContext; familyContact: string };

/**
 * Guided onboarding per the user story map:
 * 3 short feature intros → elder profile review + confirm read →
 * add observations (fill the gaps) → "you're all set".
 */
export function OnboardingWizard({ caregiverName, elder, familyContact }: Props) {
  const [step, setStep] = useState(0);
  const [confirmedRead, setConfirmedRead] = useState(false);
  const [observations, setObservations] = useState("");
  const [calming, setCalming] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const firstName = caregiverName.split(" ")[0];
  const elderShort = elder.name.split(" ").slice(0, 2).join(" ");

  const go = (next: number, label: string) => {
    setStep(next);
    void trackOnboardingStepAction(label);
  };

  const finish = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("observations", observations);
      fd.set("calming", calming);
      await completeOnboardingAction(fd);
      router.push("/copilot");
      router.refresh();
    });
  };

  const intros = [
    {
      icon: "💬",
      title: "Ask anything, anytime",
      body: `The Care Copilot answers your questions mid-shift — "she won't eat", "what's a good activity today?" — with guidance tailored to ${elderShort}, not generic advice.`,
      action: "Show me more",
    },
    {
      icon: "📖",
      title: "Playbooks for the hard moments",
      body: "For high-stakes situations — evening confusion, a fall, refusing medication — the copilot brings up step-by-step playbooks reviewed by clinicians, so you never have to improvise.",
      action: "Got it",
    },
    {
      icon: "🔔",
      title: "Safety net + family peace of mind",
      body: `If something you describe looks risky, Alongside flags it immediately. And each evening, one tap drafts a warm daily update sent to ${familyContact} on WhatsApp — you approve every word first.`,
      action: `Meet ${elderShort}'s profile`,
    },
  ];

  // Steps 0–2: intros · 3: profile review · 4: add observations · 5: all set
  return (
    <div className="app-shell px-7 py-8">
      {/* progress */}
      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-terra" : "bg-sand"}`}
          />
        ))}
      </div>

      {step < 3 && (
        <div className="fade-up flex flex-1 flex-col justify-between" key={step}>
          <div className="pt-8">
            {step === 0 && (
              <p className="mb-6 text-[15px] font-medium text-terra">Welcome, {firstName} 👋</p>
            )}
            <div className="mb-5 text-5xl">{intros[step].icon}</div>
            <h1 className="font-display text-[28px] leading-tight">{intros[step].title}</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{intros[step].body}</p>
          </div>
          <button
            onClick={() => go(step + 1, `intro_${step + 1}`)}
            className="mb-2 w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep"
          >
            {intros[step].action}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="fade-up flex flex-1 flex-col">
          <h1 className="font-display text-[26px] leading-tight">
            Meet <span className="text-terra">{elderShort}</span>
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            Her family and our team prepared this for you. Take a minute — it&apos;s what makes the
            copilot&apos;s advice personal.
          </p>

          <div className="mt-5 flex-1 space-y-3 overflow-y-auto pb-4">
            <ProfileCard title={`🌺 ${elder.name}${elder.age ? `, ${elder.age}` : ""}`} body={elder.bio} />
            <ProfileCard title="Health conditions" body={elder.conditions.join(" · ") || "None listed"} />
            <ProfileCard title="Care needs" body={elder.care_needs} />
            <ProfileCard title="Daily routine" body={elder.routine} />
            <ProfileCard title="Favorite foods" body={elder.prefs.favorite_foods} />
            <ProfileCard title="Dietary restrictions" body={elder.prefs.dietary_restrictions} accent />
            <ProfileCard title="What calms her" body={elder.prefs.calming_strategies} />
            <ProfileCard title="Dislikes" body={elder.prefs.dislikes} />
            <ProfileCard title="Mobility" body={elder.prefs.mobility_limits} accent />
            <ProfileCard title="How to communicate" body={elder.prefs.communication_style} />
          </div>

          <label className="mb-3 flex items-start gap-3 rounded-2xl bg-moss-soft p-4 text-[14px] leading-snug text-moss">
            <input
              type="checkbox"
              checked={confirmedRead}
              onChange={(e) => setConfirmedRead(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-moss"
            />
            <span>
              I&apos;ve read {elderShort}&apos;s profile and feel ready for my first shift.
            </span>
          </label>
          <button
            onClick={() => go(4, "profile_confirmed")}
            disabled={!confirmedRead}
            className="mb-2 w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="fade-up flex flex-1 flex-col">
          <h1 className="font-display text-[26px] leading-tight">Add what you notice</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            You&apos;ll often spot things nobody else does. Anything you add makes the copilot
            smarter about {elderShort}. (Optional — you can always add more later.)
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Observations so far — favorite foods, moods, little habits…
              </span>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                placeholder="e.g. She loves telling stories about the market while drinking her morning tea"
                className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Anything you&apos;ve found that calms or cheers her up?
              </span>
              <textarea
                value={calming}
                onChange={(e) => setCalming(e.target.value)}
                rows={3}
                placeholder="e.g. Humming along to keroncong songs settles her in minutes"
                className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
              />
            </label>
          </div>

          <div className="mt-auto space-y-2 pt-6">
            <button
              onClick={() => go(5, "observations_added")}
              className="w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep"
            >
              {observations || calming ? "Save & continue" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="fade-up flex flex-1 flex-col justify-between">
          <div className="pt-10">
            <div className="mb-5 text-5xl">🎉</div>
            <h1 className="font-display text-[30px] leading-tight">
              You&apos;re all set, {firstName}.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
              Here&apos;s where to find help whenever you need it:
            </p>
            <ul className="mt-5 space-y-3 text-[15px] text-ink-soft">
              <li className="flex gap-3"><span>💬</span><span><strong className="text-ink">Copilot</strong> — ask anything about {elderShort}&apos;s care, any time</span></li>
              <li className="flex gap-3"><span>📖</span><span><strong className="text-ink">Playbooks</strong> — step-by-step guides for the hard moments</span></li>
              <li className="flex gap-3"><span>🌺</span><span><strong className="text-ink">Elder</strong> — {elderShort}&apos;s profile &amp; your notes</span></li>
              <li className="flex gap-3"><span>🔔</span><span><strong className="text-ink">Alerts</strong> — anything flagged for safety</span></li>
              <li className="flex gap-3"><span>💌</span><span><strong className="text-ink">Digest</strong> — the daily family update, drafted for you</span></li>
            </ul>
          </div>
          <button
            onClick={finish}
            disabled={pending}
            className="mb-2 w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-60"
          >
            {pending ? "Opening the copilot…" : "Go to the copilot"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  if (!body) return null;
  return (
    <div className={`rounded-2xl p-4 shadow-card ${accent ? "bg-amber-soft" : "bg-card"}`}>
      <p className={`text-[12px] font-bold uppercase tracking-wide ${accent ? "text-amber" : "text-ink-faint"}`}>
        {title}
      </p>
      <p className="mt-1 text-[14.5px] leading-relaxed text-ink">{body}</p>
    </div>
  );
}
