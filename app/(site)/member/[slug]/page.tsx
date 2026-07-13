import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RadioSection from "@/components/player/RadioSection";
import { requireMember } from "@/lib/auth";
import { getFilmForRelease, getReleaseBySlug, getTracks } from "@/lib/data";
import { entitlementsForEmail } from "@/lib/entitlements";

export default async function MemberReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireMember();
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) notFound();

  const entitlements = await entitlementsForEmail(session.email);
  const owned = entitlements.filter((e) => e.release_id === release.id);
  if (owned.length === 0) redirect("/member");
  const isDeluxe = owned.some((e) => e.tier === "deluxe");

  const [tracks, film] = await Promise.all([
    getTracks(release.id),
    getFilmForRelease(release.id),
  ]);

  const queue = {
    releaseId: release.id,
    releaseTitle: release.title,
    artwork: release.artwork,
    tracks: tracks.map((t) => ({ id: t.id, title: t.title, duration: t.duration })),
  };

  const downloads: { label: string; tier: string; available: boolean }[] = [];
  downloads.push({
    label: "Standard album pack (zip)",
    tier: "standard",
    available: Boolean(release.download_standard_key),
  });
  if (isDeluxe) {
    downloads.push({
      label: "Deluxe pack (zip)",
      tier: "deluxe",
      available: Boolean(release.download_deluxe_key),
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <Link href="/member" className="text-xs text-neutral-500 hover:text-cyan">
        ← Your signal
      </Link>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded border border-edge bg-black sm:h-32 sm:w-32">
          {release.artwork && (
            <Image src={release.artwork} alt={release.title} fill sizes="128px" className="object-cover" />
          )}
        </div>
        <div>
          <p className="display neon-cyan text-[10px] tracking-[0.3em]">
            {isDeluxe ? "DELUXE ACCESS" : "STANDARD ACCESS"}
          </p>
          <h1 className="display mt-1 text-3xl font-bold tracking-wider text-white sm:text-4xl">
            {release.title}
          </h1>
        </div>
      </div>

      <div className="mt-10 space-y-14">
        <RadioSection queue={queue} />

        <section>
          <h2 className="display mb-4 text-2xl font-bold tracking-wider text-gold">DOWNLOADS</h2>
          <div className="divide-y divide-edge overflow-hidden rounded border border-edge bg-panel">
            {downloads.map((d) =>
              d.available ? (
                <a
                  key={d.tier}
                  href={`/api/member/download?release=${release.id}&tier=${d.tier}`}
                  className="flex items-center justify-between px-4 py-4 text-sm text-neutral-200 transition hover:bg-ink/60"
                >
                  <span>{d.label}</span>
                  <span className="display text-xs tracking-widest text-gold">DOWNLOAD ↓</span>
                </a>
              ) : (
                <div
                  key={d.tier}
                  className="flex items-center justify-between px-4 py-4 text-sm text-neutral-600"
                >
                  <span>{d.label}</span>
                  <span className="text-xs">Coming soon</span>
                </div>
              )
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Download links are personal and expire — grab a fresh one from this page any time.
          </p>
        </section>

        {film && (
          <section>
            <h2 className="display mb-4 text-2xl font-bold tracking-wider text-gold">THE FILM</h2>
            {isDeluxe ? (
              <Link
                href={`/member/${release.slug}/film`}
                className="group block overflow-hidden rounded border border-edge bg-panel transition hover:border-cyan/60"
              >
                <div className="relative aspect-video bg-black">
                  {film.poster && (
                    <Image
                      src={film.poster}
                      alt={film.title}
                      fill
                      sizes="(max-width: 896px) 100vw, 896px"
                      className="object-cover opacity-80 transition group-hover:opacity-100"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan/70 bg-ink/70 text-cyan shadow-neon-cyan transition group-hover:scale-110">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </div>
                <div className="px-4 py-3">
                  <h3 className="display text-lg font-bold tracking-wider text-white">
                    {film.title}
                  </h3>
                  {film.description && (
                    <p className="mt-1 text-sm text-neutral-400">{film.description}</p>
                  )}
                </div>
              </Link>
            ) : (
              <div className="rounded border border-edge bg-panel p-6">
                <p className="text-sm text-neutral-400">
                  <span className="text-cyan">{film.title}</span> streams with Deluxe access.
                </p>
                <Link
                  href={`/store/${release.slug}`}
                  className="display mt-4 inline-block rounded border border-cyan px-5 py-2.5 text-xs font-bold tracking-widest text-cyan transition hover:shadow-neon-cyan"
                >
                  UPGRADE TO DELUXE
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
