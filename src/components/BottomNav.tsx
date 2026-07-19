"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/copilot", label: "Copilot", icon: "💬" },
  { href: "/playbooks", label: "Playbooks", icon: "📖" },
  { href: "/elder", label: "Elder", icon: "🌺" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/digest", label: "Digest", icon: "💌" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-sand bg-card/95 backdrop-blur"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="flex justify-around px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors ${
                active ? "text-terra-deep" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              <span className={`text-lg leading-none ${active ? "" : "grayscale opacity-70"}`}>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
