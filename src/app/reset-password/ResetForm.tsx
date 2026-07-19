"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, {});

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-moss-soft p-4 text-[14.5px] text-moss">
          <p className="font-semibold">Password updated ✓</p>
          <p className="mt-1">You can now log in with your new password.</p>
        </div>
        <Link
          href="/login"
          className="block w-full rounded-2xl bg-terra px-5 py-4 text-center text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
        />
      </label>
      {state.error && (
        <p className="rounded-xl bg-alert-soft px-4 py-3 text-[14px] text-alert">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card hover:bg-terra-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
