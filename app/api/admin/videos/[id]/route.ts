import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { getAsset } from "@/lib/mux";
import { db } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // FEATURED is exclusive: featuring one un-features the rest.
  if (body.featured === true) {
    await db().from("videos").update({ featured: false }).neq("id", id);
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.published === "boolean") patch.published = body.published;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if ("thumbnail" in body) patch.thumbnail = body.thumbnail || null;

  const { data, error } = await db().from("videos").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ video: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { error } = await db().from("videos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** POST — sync playback id from Mux for a video whose asset was still processing. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: video } = await db().from("videos").select("*").eq("id", id).maybeSingle();
  if (!video?.mux_asset_id) return NextResponse.json({ error: "No Mux asset" }, { status: 400 });

  const asset = await getAsset(video.mux_asset_id);
  const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id ?? null;
  if (asset.status !== "ready" || !playbackId) {
    return NextResponse.json({ status: asset.status, ready: false });
  }
  const { data, error } = await db()
    .from("videos")
    .update({ playback_id: playbackId })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ready", ready: true, video: data });
}
