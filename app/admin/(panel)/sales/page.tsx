import { db } from "@/lib/supabase";

export const metadata = { title: "Sales" };

export default async function AdminSalesPage() {
  const { data } = await db()
    .from("entitlements")
    .select("id, tier, amount_cents, currency, created_at, revoked_at, customers(email), releases(title)")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as any[];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl font-bold tracking-wider text-gold">SALES</h1>
        <div className="flex gap-3">
          <a
            href="/api/admin/sales.csv"
            className="display rounded bg-gold px-4 py-2 text-xs font-bold tracking-widest text-ink transition hover:shadow-neon-gold"
          >
            EXPORT CSV ↓
          </a>
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noreferrer"
            className="display rounded border border-edge px-4 py-2 text-xs font-bold tracking-widest text-neutral-300 transition hover:border-cyan hover:text-cyan"
          >
            STRIPE ↗
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-edge bg-panel">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="display border-b border-edge text-[11px] tracking-widest text-neutral-500">
              <th className="px-4 py-3">EMAIL</th>
              <th className="px-4 py-3">RELEASE</th>
              <th className="px-4 py-3">TIER</th>
              <th className="px-4 py-3">AMOUNT</th>
              <th className="px-4 py-3">DATE</th>
              <th className="px-4 py-3">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No sales yet. The tower is warmed up.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={r.revoked_at ? "opacity-50" : ""}>
                <td className="px-4 py-3 text-neutral-200">{r.customers?.email}</td>
                <td className="px-4 py-3 text-neutral-300">{r.releases?.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`display text-[10px] font-bold tracking-widest ${
                      r.tier === "deluxe" ? "text-cyan" : "text-gold"
                    }`}
                  >
                    {r.tier?.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-200">
                  {r.amount_cents != null ? `$${(r.amount_cents / 100).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.revoked_at ? (
                    <span className="text-onair">refunded</span>
                  ) : (
                    <span className="text-neutral-500">active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
