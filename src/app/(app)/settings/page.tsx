import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId, getFamilyContacts } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id);
  const db = getDb();
  const elder = elderId
    ? (db.prepare("SELECT name FROM elders WHERE id = ?").get(elderId) as { name: string })
    : null;
  const contacts = elderId ? getFamilyContacts(elderId) : [];

  return (
    <div className="flex-1 px-5 py-4 pb-8">
      <h1 className="font-display text-[24px]">Settings</h1>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Your account</p>
          <p className="mt-1 text-[15.5px] font-semibold">{user.name}</p>
          <p className="text-[13.5px] text-ink-soft">{user.email}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            Need to change your name or email? During the pilot, message the Alongside team and
            we&apos;ll update it for you the same day.
          </p>
        </div>

        {elder && (
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Care circle</p>
            <p className="mt-1 text-[14.5px]">
              Caring for <strong>{elder.name}</strong>
            </p>
            {contacts.length > 0 && (
              <p className="mt-1 text-[13.5px] text-ink-soft">
                Family contacts: {contacts.map((c) => `${c.name} (${c.channel})`).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">About Alongside</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            Alongside offers care guidance, not medical advice. In an emergency, always call your
            local emergency number. Care conversations are private and protected — sign out on
            shared devices.
          </p>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
