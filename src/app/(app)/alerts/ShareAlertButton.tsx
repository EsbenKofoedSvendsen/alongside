"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareAlertAction } from "@/lib/actions/care";

export function ShareAlertButton({ alertId, shared }: { alertId: number; shared: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-ink-soft">
        {shared ? "✓ Will appear in today's family digest" : "Not shared with family yet"}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await shareAlertAction(alertId, !shared);
            router.refresh();
          })
        }
        className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
          shared ? "border border-sand bg-card text-ink-soft" : "bg-moss text-white"
        }`}
      >
        {pending ? "…" : shared ? "Unshare" : "Share with family"}
      </button>
    </div>
  );
}
