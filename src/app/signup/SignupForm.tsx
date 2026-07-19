"use client";

import { useActionState } from "react";
import { signupAction, type ActionState } from "@/lib/actions/auth";

export function SignupForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signupAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Your full name">
        <input name="name" required autoComplete="name" placeholder="e.g. Rina Kusuma" className={inputCls} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputCls} />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </Field>
      <label className="flex items-start gap-3 pt-1 text-[13.5px] leading-snug text-ink-soft">
        <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-terra" />
        <span>
          I agree to the Terms of Service and consent to Alongside processing care information to
          provide guidance, per the Privacy Policy.
        </span>
      </label>

      {state.error && (
        <p className="rounded-xl bg-alert-soft px-4 py-3 text-[14px] text-alert">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-terra px-5 py-4 text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-terra-deep disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
