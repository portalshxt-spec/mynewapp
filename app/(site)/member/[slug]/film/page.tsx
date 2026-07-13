import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FilmPlayer from "@/components/FilmPlayer";
import { requireMember } from "@/lib/auth";
import { getFilmForRelease, getReleaseBySlug } from "@/lib/data";
import { hasEntitlement } from "@/lib/entitlements";
import { signPlaybackTokens } from "@/lib/mux";

export default async function FilmPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireMember();
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) notFound();

  const deluxe = await hasEntitlement(session.email, release.id, "deluxe");
  if (!deluxe) redirect(`/member/${slug}`);

  const film = await getFilmForRelease(release.id);
  if (!film || !film.playback_id) notFound();

  // Signed playback tokens: the stream is unwatchable without them and they expire,
  // so the film can't be hotlinked or shared.
  const tokens = await signPlaybackTokens(film.playback_id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <Link href={`/member/${slug}`} className="text-xs text-neutral-500 hover:text-cyan">
        ← {release.title}
      </Link>
      <h1 className="display mt-3 text-3xl font-bold tracking-wider text-gold sm:text-4xl">
        {film.title}
      </h1>
      {film.description && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          {film.description}
        </p>
      )}
      <div className="mt-8 overflow-hidden rounded border border-edge bg-black">
        <FilmPlayer
          playbackId={film.playback_id}
          title={film.title}
          poster={film.poster}
          tokens={tokens}
        />
      </div>
    </div>
  );
}
