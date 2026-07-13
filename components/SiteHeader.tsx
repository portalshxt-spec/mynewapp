import Link from "next/link";
import BrokenHeart from "./BrokenHeart";

const NAV = [
  { href: "/", label: "SIGNAL" },
  { href: "/band", label: "THE BAND" },
  { href: "/store", label: "STORE" },
  { href: "/access", label: "ACCESS" },
];

export default function SiteHeader({ tagline }: { tagline: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <BrokenHeart />
          <span className="leading-tight">
            <span className="display block text-xl font-bold tracking-wider text-gold sm:text-2xl">
              BLakHarts
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.25em] text-cyan/80 sm:block">
              {tagline}
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="display text-xs font-semibold tracking-widest text-neutral-300 transition-colors hover:text-cyan sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
