import { db } from "@/lib/supabase";

export const metadata = { title: "BlakHarts List" };

export default async function AdminSignupsPage() {
  const { data } = await db()
    .from("signups")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = data ?? [];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl font-bold tracking-wider text-gold">BLAKHARTS LIST</h1>
        <a
          href="/api/admin/signups.csv"
          className="display rounded bg-gold px-4 py-2 text-xs font-bold tracking-widest text-ink transition hover:shadow-neon-gold"
        >
          EXPORT CSV ↓
        </a>
      </div>

      <div className="overflow-x-auto rounded border border-edge bg-panel">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="display border-b border-edge text-[11px] tracking-widest text-neutral-500">
              <th className="px-4 py-3">EMAIL</th>
              <th className="px-4 py-3">SIGNED UP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-neutral-500">
                  No BlakHarts yet. Spread the signal.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-neutral-200">{r.email}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(r.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
