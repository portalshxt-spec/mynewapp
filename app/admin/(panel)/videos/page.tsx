import VideosManager from "@/components/admin/VideosManager";
import { db } from "@/lib/supabase";
import type { Video } from "@/lib/types";

export const metadata = { title: "Videos" };

export default async function AdminVideosPage() {
  const { data } = await db().from("videos").select("*").order("position");

  return (
    <div>
      <h1 className="display mb-8 text-3xl font-bold tracking-wider text-gold">VIDEOS</h1>
      <VideosManager initialVideos={(data as Video[]) ?? []} />
    </div>
  );
}
