import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { entitlementsForEmail } from "@/lib/entitlements";
import { db } from "@/lib/supabase";
import type { Release, Tier } from "@/lib/types";

export const metadata = { title: "Member Broadcast" };

export default async function MemberHome() {
  const session = await requireMember();
  const entitlements = await entitlementsForEmail(session.email);

  const releaseIds = [...new Set(entitlements.map((e) => e.release_id))];
  let releases: Release[] = [];
  if (releaseIds.length > 0) {
    const { data } = await db().from("releases").select("*").in("id", releaseIds);
    releases = (data as Release[]) ?? [];
  }
  const tierFor = (id: string): Tier =>
    entitlements.some((e) => e.release_id === id && e.tier === "deluxe") ? "deluxe" : "standard";

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p className="display neon-cyan text-xs tracking-[0.3em]">MEMBER BROADCAST</p>
      <h1 className="display mt-2 text-4xl font-bold tracking-wider text-gold">YOUR SIGNAL</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Tuned in as <span className="text-white">{session.email}</span>
      </p>

      {releases.length === 0 ? (
        <div className="mt-16 rounded border border-edge bg-panel p-10 text-center">
          <p className="display text-lg tracking-widest text-neutral-500">NO FREQUENCIES YET</p>
          <p className="mt-3 text-sm text-neutral-500">
            Grab a release from the{" "}
            <Link href="/store" className="text-cyan underline">
              store
            </Link>{" "}
            to unlock the broadcast.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {releases.map((r) => (
            <Link
              key={r.id}
              href={`/member/${r.slug}`}
              className="group overflow-hidden rounded border border-edge bg-panel transition hover:border-gold/60"
            >
              <div className="relative aspect-square bg-black">
                {r.artwork && (
                  <Image
                    src={r.artwork}
                    alt={r.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition group-hover:scale-[1.02]"
                  />
                )}
                <span
                  className={`display absolute right-2 top-2 rounded px-2 py-1 text-[10px] font-bold tracking-widest ${
                    tierFor(r.id) === "deluxe"
                      ? "border border-cyan bg-ink/80 text-cyan"
                      : "border border-gold bg-ink/80 text-gold"
                  }`}
                >
                  {tierFor(r.id).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="display truncate text-lg font-bold tracking-wider text-white">
                  {r.title}
                </h2>
                <span className="display shrink-0 text-xs tracking-widest text-cyan">
                  TUNE IN →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
