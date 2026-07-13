import Image from "next/image";
import Link from "next/link";
import EmailSignup from "@/components/EmailSignup";
import HeroVideo from "@/components/HeroVideo";
import ReleaseCard from "@/components/ReleaseCard";
import VideoWall from "@/components/VideoWall";
import { getFeaturedVideo, getPublishedReleases, getPublishedVideos } from "@/lib/data";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, featured, videos, releases] = await Promise.all([
    getSettings(),
    getFeaturedVideo(),
    getPublishedVideos(),
    getPublishedReleases(),
  ]);
  const latest = releases[0] ?? null;
  const wallVideos = videos.filter((v) => v.id !== featured?.id);

  return (
    <>
      {/* HERO — featured music video */}
      <section className="relative border-b border-edge bg-black">
        {featured?.playback_id ? (
          <HeroVideo playbackId={featured.playback_id} title={featured.title} />
        ) : (
          <div className="static-texture flex aspect-[16/7] w-full items-center justify-center">
            <p className="display neon-cyan text-xl tracking-[0.3em]">SIGNAL ACQUIRING…</p>
          </div>
        )}
      </section>
      <section className="static-texture border-b border-edge">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <h1 className="display mx-auto max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl">
            {settings.hero_line}
          </h1>
          <p className="neon-cyan display mt-4 text-sm tracking-[0.3em]">{settings.tagline}</p>
        </div>
      </section>

      {/* LATEST RELEASE */}
      {latest && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="display mb-6 text-2xl font-bold tracking-wider text-gold">
            LATEST TRANSMISSION
          </h2>
          <div className="mx-auto max-w-3xl">
            <ReleaseCard release={latest} big />
          </div>
        </section>
      )}

      {/* VIDEO WALL */}
      {wallVideos.length > 0 && (
        <section className="border-t border-edge">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="display mb-6 text-2xl font-bold tracking-wider text-gold">
              THE VIDEO WALL
            </h2>
            <VideoWall videos={wallVideos} />
          </div>
        </section>
      )}

      {/* BAND */}
      <section className="border-t border-edge">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="display text-2xl font-bold tracking-wider text-gold">THE BAND</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
                {settings.lore_text.slice(0, 180)}…
              </p>
            </div>
            <Link
              href="/band"
              className="display shrink-0 rounded border border-cyan px-6 py-3 text-xs font-bold tracking-widest text-cyan transition hover:shadow-neon-cyan"
            >
              MEET THE SIGNAL →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {settings.band_members.map((m) => (
              <Link
                key={m.name}
                href="/band"
                className="group overflow-hidden rounded border border-edge bg-panel"
              >
                <div className="relative aspect-square bg-ink">
                  {m.image ? (
                    <Image
                      src={m.image}
                      alt={m.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 20vw"
                      className="object-cover opacity-80 transition group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-neutral-800">
                      ▲
                    </div>
                  )}
                </div>
                <p className="display truncate px-2 py-2 text-center text-xs font-semibold tracking-wider text-neutral-300">
                  {m.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <EmailSignup header={settings.signup_header} subtext={settings.signup_subtext} />
    </>
  );
}
