import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One-click CSV export of sales for chart reporting. */
export async function GET() {
  if (!(await apiAdminSession())) return new Response("Unauthorized", { status: 401 });

  const { data } = await db()
    .from("entitlements")
    .select("tier, amount_cents, currency, created_at, revoked_at, customers(email), releases(title)")
    .order("created_at", { ascending: false });

  const header = "email,release,tier,amount,currency,date,refunded";
  const rows = (data ?? []).map((row: any) =>
    [
      csvCell(row.customers?.email),
      csvCell(row.releases?.title),
      csvCell(row.tier),
      csvCell(row.amount_cents != null ? (row.amount_cents / 100).toFixed(2) : ""),
      csvCell((row.currency ?? "usd").toUpperCase()),
      csvCell(row.created_at),
      csvCell(row.revoked_at ? "yes" : "no"),
    ].join(",")
  );

  return new Response([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="blakharts-sales-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
