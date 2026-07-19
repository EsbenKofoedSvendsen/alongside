"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
        />
      </label>

      {state.error && (
        <p className="rounded-xl bg-alert-soft px-4 py-3 text-[14px] text-alert">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-terra-deep disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>

      <p className="pt-1 text-center">
        <Link href="/forgot-password" className="text-[14px] text-ink-faint underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
