import Link from "next/link";
import { getDb } from "@/lib/db";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token
    ? (getDb()
        .prepare(
          "SELECT i.status, e.name AS elder_name FROM invitations i JOIN elders e ON e.id = i.elder_id WHERE i.token = ?"
        )
        .get(token) as { status: string; elder_name: string } | undefined)
    : undefined;

  if (!token || !invite || invite.status !== "pending") {
    return (
      <div className="app-shell items-center justify-center px-8 text-center">
        <div>
          <h1 className="font-display text-2xl">Signup is by invitation</h1>
          <p className="mt-3 text-[15px] text-ink-soft">
            During the pilot, accounts are created through an invitation link sent by the Alongside
            team when a family brings you on.
          </p>
          <Link href="/login" className="mt-6 inline-block font-semibold text-terra underline">
            Log in instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell px-7 py-10">
      <h1 className="font-display text-[28px] leading-tight">Create your account</h1>
      <p className="mb-7 mt-2 text-[15px] text-ink-soft">
        You&apos;re joining {invite.elder_name}&apos;s care circle.
      </p>
      <SignupForm token={token} />
      <p className="mt-6 text-center text-[13px] text-ink-faint">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-terra underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
