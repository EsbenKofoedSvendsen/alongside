"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ActionState } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, {});

  return (
    <div className="app-shell px-7 py-10">
      <h1 className="font-display pt-4 text-[28px] leading-tight">Reset your password</h1>
      <p className="mb-7 mt-2 text-[15px] text-ink-soft">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {state.ok ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-moss-soft p-4 text-[14.5px] leading-relaxed text-moss">
            <p className="font-semibold">Check your messages 📬</p>
            <p className="mt-1">If an account exists for that email, a reset link has been sent.</p>
            {state.info && (
              <p className="mt-3 border-t border-moss/20 pt-3 text-[13px]">
                <span className="font-semibold">Pilot mode</span> (no email service connected):{" "}
                <Link href={state.info} className="underline">
                  open your reset link
                </Link>
              </p>
            )}
          </div>
          <Link href="/login" className="block text-center text-[14px] font-semibold text-terra underline">
            Back to login
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
          />
          {state.error && (
            <p className="rounded-xl bg-alert-soft px-4 py-3 text-[14px] text-alert">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className="block text-center text-[14px] text-ink-faint underline">
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}
