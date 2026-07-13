import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { Release } from "@/lib/types";

export default function ReleaseCard({ release, big = false }: { release: Release; big?: boolean }) {
  return (
    <Link
      href={`/store/${release.slug}`}
      className="group block overflow-hidden rounded border border-edge bg-panel transition hover:border-gold/60"
    >
      <div className={`relative w-full bg-black ${big ? "aspect-square sm:aspect-[2/1]" : "aspect-square"}`}>
        {release.artwork ? (
          <Image
            src={release.artwork}
            alt={release.title}
            fill
            sizes={big ? "(max-width: 640px) 100vw, 768px" : "(max-width: 640px) 100vw, 33vw"}
            className="object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-700">
            <span className="display text-4xl tracking-widest">BLH</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h3 className="display truncate text-lg font-bold tracking-wider text-white">
            {release.title}
          </h3>
          <p className="text-xs text-neutral-500">
            {release.price_standard_cents != null && (
              <>From {formatPrice(release.price_standard_cents)}</>
            )}
          </p>
        </div>
        <span className="display shrink-0 rounded bg-gold px-4 py-2 text-xs font-bold tracking-widest text-ink transition group-hover:shadow-neon-gold">
          BUY
        </span>
      </div>
    </Link>
  );
}
