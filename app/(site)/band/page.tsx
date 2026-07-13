import Image from "next/image";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "The Band" };

export default async function BandPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="display text-4xl font-bold tracking-wider text-gold">THE BAND</h1>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {settings.band_members.map((m) => (
          <article
            key={m.name}
            className="overflow-hidden rounded border border-edge bg-panel transition hover:border-gold/50"
          >
            <div className="relative aspect-square bg-ink">
              {m.image ? (
                <Image
                  src={m.image}
                  alt={m.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="static-texture flex h-full items-center justify-center">
                  <span className="display text-5xl text-neutral-800">▲</span>
                </div>
              )}
            </div>
            <div className="p-5">
              <h2 className="display text-xl font-bold tracking-wider text-white">{m.name}</h2>
              <p className="neon-cyan mt-1 text-xs uppercase tracking-widest">{m.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">{m.bio}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="static-texture mt-14 rounded border border-edge bg-panel p-8 sm:p-12">
        <h2 className="display text-2xl font-bold tracking-wider text-gold">
          {settings.lore_title}
        </h2>
        <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-relaxed text-neutral-300">
          {settings.lore_text}
        </p>
      </section>
    </div>
  );
}
