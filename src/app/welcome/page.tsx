import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="app-shell justify-between px-7 py-10">
      <div />
      <div className="fade-up">
        <div className="mb-5 text-5xl">🤝</div>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Along<span className="text-terra">side</span>
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
          An AI care copilot that turns compassionate companions into confident caregivers.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-faint">
          We bring the expertise. You bring the companionship. The family gains peace of mind.
        </p>
        <div className="mt-8 rounded-2xl bg-moss-soft p-4 text-[14px] leading-relaxed text-moss">
          <strong>Invited to care for someone?</strong> Open the invitation link you received on
          WhatsApp or text — it connects you to their care profile.
        </div>
      </div>
      <div className="space-y-3 pb-2">
        <Link
          href="/login"
          className="block w-full rounded-2xl bg-terra px-5 py-4 text-center text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-terra-deep"
        >
          Log in
        </Link>
        <p className="text-center text-[13px] text-ink-faint">
          Alongside is invitation-only during the pilot.
        </p>
      </div>
    </div>
  );
}
