import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.role === "ops") redirect("/ops");
  if (!user.onboarded_at) redirect("/onboarding");

  const elderId = getCaregiverElderId(user.id);
  const elder = elderId
    ? (getDb().prepare("SELECT name, photo_emoji FROM elders WHERE id = ?").get(elderId) as {
        name: string;
        photo_emoji: string;
      })
    : null;

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 border-b border-sand bg-cream/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terra-soft text-lg">
              {elder?.photo_emoji ?? "🌺"}
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Caring for
              </p>
              <p className="text-[14px] font-semibold leading-tight">{elder?.name ?? "—"}</p>
            </div>
          </div>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-[15px] shadow-card"
            aria-label="Settings"
          >
            ⚙️
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
