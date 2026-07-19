import Link from "next/link";
import { getDb } from "@/lib/db";

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = getDb();
  const rows = (
    q
      ? db
          .prepare("SELECT slug, title, category, summary FROM playbooks WHERE title LIKE ? OR summary LIKE ? OR category LIKE ? ORDER BY category, title")
          .all(`%${q}%`, `%${q}%`, `%${q}%`)
      : db.prepare("SELECT slug, title, category, summary FROM playbooks ORDER BY category, title").all()
  ) as Array<{ slug: string; title: string; category: string; summary: string }>;

  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }

  return (
    <div className="flex-1 px-5 py-4">
      <h1 className="font-display text-[24px]">Care playbooks</h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        Step-by-step guides for high-stakes moments, reviewed by clinicians. The copilot brings
        these up automatically when a situation matches.
      </p>

      <form className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search playbooks…"
          className="w-full rounded-xl border border-sand bg-card px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-terra"
        />
      </form>

      <div className="mt-5 space-y-6 pb-6">
        {rows.length === 0 && <p className="text-[14px] text-ink-faint">No playbooks match “{q}”.</p>}
        {[...byCategory.entries()].map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-faint">{category}</h2>
            <div className="space-y-2.5">
              {items.map((p) => (
                <Link
                  key={p.slug}
                  href={`/playbooks/${p.slug}`}
                  className="block rounded-2xl bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5"
                >
                  <p className="text-[15.5px] font-semibold">{p.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{p.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
