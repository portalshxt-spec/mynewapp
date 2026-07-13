import Link from "next/link";
import { notFound } from "next/navigation";
import ReleaseEditor from "@/components/admin/ReleaseEditor";
import { getFilmForRelease, getTracks } from "@/lib/data";
import { db } from "@/lib/supabase";
import type { Release } from "@/lib/types";

export const metadata = { title: "Edit Release" };

export default async function AdminReleaseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await db().from("releases").select("*").eq("id", id).maybeSingle();
  const release = data as Release | null;
  if (!release) notFound();

  const [tracks, film] = await Promise.all([getTracks(release.id), getFilmForRelease(release.id)]);

  return (
    <div>
      <Link href="/admin/releases" className="text-xs text-neutral-500 hover:text-cyan">
        ← All releases
      </Link>
      <h1 className="display mb-8 mt-2 text-3xl font-bold tracking-wider text-gold">
        {release.title}
      </h1>
      <ReleaseEditor initialRelease={release} initialTracks={tracks} initialFilm={film} />
    </div>
  );
}
