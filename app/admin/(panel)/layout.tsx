import Link from "next/link";
import BrokenHeart from "@/components/BrokenHeart";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "DASHBOARD" },
  { href: "/admin/releases", label: "RELEASES" },
  { href: "/admin/videos", label: "VIDEOS" },
  { href: "/admin/pages", label: "PAGES" },
  { href: "/admin/sales", label: "SALES" },
  { href: "/admin/signups", label: "BLAKHARTS LIST" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-edge bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <BrokenHeart size={22} />
            <span className="display text-lg font-bold tracking-wider text-gold">
              BLakHarts <span className="text-neutral-500">CONTROL ROOM</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="display text-[11px] font-semibold tracking-widest text-neutral-400 transition hover:text-cyan"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
            <span className="hidden sm:inline">{session.email}</span>
            <a href="/api/auth/logout" className="hover:text-onair">
              Sign out
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
