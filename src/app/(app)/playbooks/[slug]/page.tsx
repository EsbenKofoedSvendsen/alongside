import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId } from "@/lib/queries";
import { loadElderContext, personalizeSteps, type PlaybookRow } from "@/lib/copilot";

export default async function PlaybookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const playbook = db.prepare("SELECT * FROM playbooks WHERE slug = ?").get(slug) as PlaybookRow | undefined;
  if (!playbook) notFound();

  const user = (await getCurrentUser())!;
  const elderId = getCaregiverElderId(user.id)!;
  const elder = loadElderContext(elderId)!;
  const steps = personalizeSteps(playbook, elder);
  const adjusted = steps.some((s) => s.adjusted);

  return (
    <div className="flex-1 px-5 py-4 pb-8">
      <Link href="/playbooks" className="text-[13px] font-semibold text-terra">
        ← All playbooks
      </Link>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-moss">{playbook.category}</p>
      <h1 className="font-display mt-1 text-[26px] leading-tight">{playbook.title}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{playbook.summary}</p>
      {adjusted && (
        <p className="mt-3 inline-block rounded-full bg-moss-soft px-3 py-1 text-[12px] font-semibold text-moss">
          ✦ Adjusted for {elder.name}
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra-soft text-[13px] font-bold text-terra-deep">
                {i + 1}
              </span>
              <div>
                <p className="text-[15.5px] font-semibold">{s.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{s.detail}</p>
                {s.caution && (
                  <p className="mt-2 rounded-lg bg-alert-soft px-3 py-2 text-[13px] font-medium text-alert">
                    ⚠ {s.caution}
                  </p>
                )}
                {s.adjusted && (
                  <p className="mt-2 rounded-lg bg-moss-soft px-3 py-2 text-[13px] font-medium text-moss">
                    ✦ For {elder.name.split(" ").slice(0, 2).join(" ")} specifically: {s.adjusted}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-cream p-4 text-[12px] leading-relaxed text-ink-faint">
        <p>{playbook.reviewed_by} · v{playbook.version}</p>
        <p className="mt-1">
          Playbooks support — never replace — professional judgment. In an emergency, call your
          local emergency number first.
        </p>
      </div>
    </div>
  );
}
