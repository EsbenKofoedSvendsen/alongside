import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { ShareAlertButton } from "./ShareAlertButton";

export default async function AlertsPage() {
  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id)!;
  const db = getDb();
  const alerts = db
    .prepare("SELECT * FROM alerts WHERE elder_id = ? ORDER BY id DESC LIMIT 100")
    .all(elderId) as Array<{
    id: number;
    severity: "emergency" | "warning";
    title: string;
    detail: string;
    shared_with_family: number;
    created_at: string;
  }>;

  return (
    <div className="flex-1 px-5 py-4 pb-8">
      <h1 className="font-display text-[24px]">Alerts</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        When the copilot spots a risk in what you describe, it lands here. You decide what gets
        shared with the family — shared alerts appear in the daily digest.
      </p>

      <div className="mt-5 space-y-3">
        {alerts.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center shadow-card">
            <p className="text-3xl">🕊</p>
            <p className="mt-2 text-[15px] font-semibold">No alerts — all calm</p>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              If you ever describe something risky to the copilot, it will be flagged here
              automatically.
            </p>
          </div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`rounded-2xl border p-4 shadow-card ${
              a.severity === "emergency" ? "border-alert bg-alert-soft" : "border-amber bg-amber-soft"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    a.severity === "emergency" ? "text-alert" : "text-amber"
                  }`}
                >
                  {a.severity === "emergency" ? "🚨 Emergency" : "⚠️ Warning"}
                </p>
                <p className="mt-1 text-[15.5px] font-semibold">{a.title}</p>
                {a.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">“{a.detail}”</p>}
                <p className="mt-1.5 text-[11.5px] text-ink-faint">
                  {a.created_at.slice(0, 16).replace("T", " · ")}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-ink/10 pt-3">
              <ShareAlertButton alertId={a.id} shared={a.shared_with_family === 1} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
