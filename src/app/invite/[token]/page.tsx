import Link from "next/link";
import { getDb } from "@/lib/db";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const invite = db
    .prepare(
      `SELECT i.*, e.name AS elder_name, e.age AS elder_age, e.photo_emoji
       FROM invitations i JOIN elders e ON e.id = i.elder_id WHERE i.token = ?`
    )
    .get(token) as
    | { status: string; invitee_name: string; elder_name: string; elder_age: number | null; photo_emoji: string }
    | undefined;

  if (!invite || invite.status !== "pending") {
    return (
      <div className="app-shell items-center justify-center px-8 text-center">
        <div>
          <div className="mb-4 text-4xl">🥀</div>
          <h1 className="font-display text-2xl">This invitation isn&apos;t active</h1>
          <p className="mt-3 text-[15px] text-ink-soft">
            The link may have already been used or replaced. Please ask the family or the Alongside
            team to send you a fresh one.
          </p>
          <Link href="/login" className="mt-6 inline-block font-semibold text-terra underline">
            Already have an account? Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell justify-between px-7 py-10">
      <div className="fade-up pt-6">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-terra">
          You&apos;re invited
        </p>
        <h1 className="font-display mt-2 text-[32px] leading-tight">
          {invite.invitee_name ? `${invite.invitee_name}, the` : "The"} family of{" "}
          <span className="text-terra">{invite.elder_name}</span> chose you.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          Alongside gives you expert-backed answers in the moment, step-by-step guides for the hard
          situations, and a one-tap daily update to the family — so you can focus on what you do
          best: being there for {invite.elder_name.split(" ").slice(0, 2).join(" ")}.
        </p>

        <div className="mt-7 flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-terra-soft text-3xl">
            {invite.photo_emoji}
          </div>
          <div>
            <p className="font-semibold">{invite.elder_name}</p>
            <p className="text-[13px] text-ink-soft">
              {invite.elder_age ? `${invite.elder_age} years old · ` : ""}Care profile ready for you
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pb-2">
        <Link
          href={`/signup?token=${token}`}
          className="block w-full rounded-2xl bg-terra px-5 py-4 text-center text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-terra-deep"
        >
          Accept invitation
        </Link>
        <Link href="/login" className="block text-center text-[14px] text-ink-faint underline">
          I already have an account
        </Link>
      </div>
    </div>
  );
}
