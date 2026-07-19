"use client";

import { useState, useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-2xl border border-alert/40 bg-card px-5 py-3.5 text-[15px] font-semibold text-alert shadow-card"
      >
        Sign out
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <p className="text-[14.5px] font-semibold">Are you sure you want to sign out?</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Care conversations are sensitive — signing out keeps them private on shared devices.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-xl border border-sand px-4 py-3 text-[14px] font-semibold text-ink-soft"
        >
          Stay signed in
        </button>
        <button
          onClick={() => startTransition(() => logoutAction())}
          disabled={pending}
          className="flex-1 rounded-xl bg-alert px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
