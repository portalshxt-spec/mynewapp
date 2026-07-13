import Image from "next/image";
import { notFound } from "next/navigation";
import BuyButtons from "@/components/BuyButtons";
import { getFilmForRelease, getReleaseBySlug, getTracks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release || !release.published) notFound();

  const [tracks, film] = await Promise.all([
    getTracks(release.id),
    getFilmForRelease(release.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded border border-edge bg-black">
          {release.artwork ? (
            <Image
              src={release.artwork}
              alt={release.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="static-texture flex h-full items-center justify-center">
              <span className="display text-6xl text-neutral-800">BLH</span>
            </div>
          )}
        </div>

        <div>
          <h1 className="display text-4xl font-bold tracking-wider text-white">
            {release.title}
          </h1>
          {release.release_date && (
            <p className="neon-cyan mt-1 text-xs uppercase tracking-widest">
              Transmission date: {release.release_date}
            </p>
          )}
          {release.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-300">
              {release.description}
            </p>
          )}

          <div className="mt-8">
            <BuyButtons
              releaseId={release.id}
              standardCents={release.price_standard_cents}
              deluxeCents={release.price_deluxe_cents}
              hasFilm={Boolean(film)}
            />
          </div>

          <p className="mt-4 text-xs text-neutral-500">
            Instant access by email after checkout. No account, no password — your email is your
            key.
          </p>
        </div>
      </div>

      {tracks.length > 0 && (
        <section className="mt-14">
          <h2 className="display mb-4 text-2xl font-bold tracking-wider text-gold">TRACKLIST</h2>
          <ol className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className="flex items-baseline gap-3 border-b border-edge/60 py-2 text-sm"
              >
                <span className="display w-8 shrink-0 text-right text-neutral-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-neutral-300">{t.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {film && (
        <section className="static-texture mt-14 rounded border border-edge bg-panel p-8">
          <p className="display text-xs tracking-[0.3em] text-cyan">DELUXE EXCLUSIVE</p>
          <h2 className="display mt-2 text-2xl font-bold tracking-wider text-white">
            {film.title}
          </h2>
          {film.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
              {film.description}
            </p>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            The full-length film streams in the member area with Deluxe access.
          </p>
        </section>
      )}
    </div>
  );
}
