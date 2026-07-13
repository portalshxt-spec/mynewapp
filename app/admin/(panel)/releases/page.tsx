import ReleasesIndex from "@/components/admin/ReleasesIndex";
import { db } from "@/lib/supabase";
import type { Release } from "@/lib/types";

export const metadata = { title: "Releases" };

export default async function AdminReleasesPage() {
  const { data } = await db()
    .from("releases")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="display mb-8 text-3xl font-bold tracking-wider text-gold">RELEASES</h1>
      <ReleasesIndex initialReleases={(data as Release[]) ?? []} />
    </div>
  );
}
