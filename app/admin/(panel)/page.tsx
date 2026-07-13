import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { db } from "@/lib/supabase";

export const metadata = { title: "Admin Dashboard" };

async function counts() {
  if (!isSupabaseConfigured()) return null;
  try {
    const [releases, sales, signups] = await Promise.all([
      db().from("releases").select("id", { count: "exact", head: true }),
      db()
        .from("entitlements")
        .select("amount_cents")
        .is("revoked_at", null),
      db().from("signups").select("id", { count: "exact", head: true }),
    ]);
    const revenue = (sales.data ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
    return {
      releases: releases.count ?? 0,
      sales: sales.data?.length ?? 0,
      revenue,
      signups: signups.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const stats = await counts();

  const tiles = [
    { label: "RELEASES", value: stats?.releases ?? "—", href: "/admin/releases" },
    { label: "SALES", value: stats?.sales ?? "—", href: "/admin/sales" },
    {
      label: "REVENUE",
      value: stats ? `$${(stats.revenue / 100).toFixed(2)}` : "—",
      href: "/admin/sales",
    },
    { label: "BLAKHARTS", value: stats?.signups ?? "—", href: "/admin/signups" },
  ];

  return (
    <div>
      <h1 className="display text-3xl font-bold tracking-wider text-gold">DASHBOARD</h1>
      {!stats && (
        <p className="mt-4 rounded border border-onair/40 bg-panel p-4 text-sm text-onair">
          Database not reachable — check the Supabase environment variables and run
          supabase/schema.sql.
        </p>
      )}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded border border-edge bg-panel p-6 transition hover:border-gold/60"
          >
            <p className="display text-[11px] font-semibold tracking-widest text-neutral-500">
              {t.label}
            </p>
            <p className="display mt-2 text-3xl font-bold text-white">{t.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/admin/releases"
          className="display rounded bg-gold px-5 py-3 text-xs font-bold tracking-widest text-ink transition hover:shadow-neon-gold"
        >
          + NEW RELEASE
        </Link>
        <Link
          href="/admin/videos"
          className="display rounded border border-edge px-5 py-3 text-xs font-bold tracking-widest text-neutral-300 transition hover:border-cyan hover:text-cyan"
        >
          MANAGE VIDEOS
        </Link>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noreferrer"
          className="display rounded border border-edge px-5 py-3 text-xs font-bold tracking-widest text-neutral-300 transition hover:border-cyan hover:text-cyan"
        >
          STRIPE DASHBOARD ↗
        </a>
      </div>
    </div>
  );
}
