import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { createAssetFromUrl, isMuxConfigured } from "@/lib/mux";
import { db } from "@/lib/supabase";

export async function GET() {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db().from("videos").select("*").order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ videos: data });
}

/**
 * POST — create a video row.
 * body: {title, playbackId?, muxAssetId?, sourceUrl?}
 * sourceUrl kicks off a Mux ingest of a remote file (paste-a-URL flow).
 */
export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const title = String(body.title || "").trim() || "Untitled";
    let playbackId = body.playbackId ? String(body.playbackId) : null;
    let muxAssetId = body.muxAssetId ? String(body.muxAssetId) : null;

    if (body.sourceUrl) {
      if (!isMuxConfigured()) {
        return NextResponse.json({ error: "Mux is not configured" }, { status: 503 });
      }
      const asset = await createAssetFromUrl(String(body.sourceUrl), "public");
      muxAssetId = asset.id;
      playbackId = null; // filled in once Mux finishes ingesting (sync endpoint)
    }

    const { data: last } = await db()
      .from("videos")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await db()
      .from("videos")
      .insert({
        title,
        playback_id: playbackId,
        mux_asset_id: muxAssetId,
        position: (last?.position ?? -1) + 1,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ video: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 }
    );
  }
}

/** PATCH — reorder: body {order: [videoId,...]} */
export async function PATCH(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const order: string[] = Array.isArray(body.order) ? body.order : [];
  await Promise.all(
    order.map((id, i) => db().from("videos").update({ position: i }).eq("id", id))
  );
  return NextResponse.json({ ok: true });
}
