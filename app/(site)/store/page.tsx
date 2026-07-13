import ReleaseCard from "@/components/ReleaseCard";
import { getPublishedReleases } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store" };

export default async function StorePage() {
  const releases = await getPublishedReleases();

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="display text-4xl font-bold tracking-wider text-gold">STORE</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Direct from the tower. Every purchase unlocks the member broadcast.
      </p>

      {releases.length === 0 ? (
        <p className="display mt-16 text-center text-lg tracking-widest text-neutral-600">
          NEW TRANSMISSIONS LOADING…
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {releases.map((r) => (
            <ReleaseCard key={r.id} release={r} />
          ))}
        </div>
      )}
    </div>
  );
}
