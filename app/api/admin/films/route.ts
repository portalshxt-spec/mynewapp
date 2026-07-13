import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { getAsset } from "@/lib/mux";
import { db } from "@/lib/supabase";

/**
 * POST — create/update the film attached to a release.
 * body: {releaseId, title?, description?, poster?, muxAssetId?}
 * Film assets always use the SIGNED playback policy (Deluxe paywall).
 */
export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const releaseId = String(body.releaseId || "");
    if (!releaseId) return NextResponse.json({ error: "Missing releaseId" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title.trim() || "The Film";
    if ("description" in body) patch.description = body.description || null;
    if ("poster" in body) patch.poster = body.poster || null;
    if (body.muxAssetId) {
      patch.mux_asset_id = String(body.muxAssetId);
      // Pull the signed playback id if the asset is already ready.
      try {
        const asset = await getAsset(String(body.muxAssetId));
        const signed = asset.playback_ids?.find((p) => p.policy === "signed")?.id;
        if (signed) patch.playback_id = signed;
      } catch {
        /* sync endpoint will pick it up later */
      }
    }

    const { data: existing } = await db()
      .from("films")
      .select("id, title")
      .eq("release_id", releaseId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await db()
        .from("films")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ film: data });
    }

    const { data, error } = await db()
      .from("films")
      .insert({ release_id: releaseId, title: (patch.title as string) || "The Film", ...patch })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ film: data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** PATCH — sync the signed playback id for a film still processing on Mux. body: {releaseId} */
export async function PATCH(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const releaseId = String(body.releaseId || "");
  const { data: film } = await db().from("films").select("*").eq("release_id", releaseId).maybeSingle();
  if (!film?.mux_asset_id) return NextResponse.json({ error: "No Mux asset" }, { status: 400 });

  const asset = await getAsset(film.mux_asset_id);
  const signed = asset.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;
  if (asset.status !== "ready" || !signed) {
    return NextResponse.json({ status: asset.status, ready: false });
  }
  const { data, error } = await db()
    .from("films")
    .update({ playback_id: signed })
    .eq("id", film.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ready", ready: true, film: data });
}

/** DELETE — detach the film from a release. body: {releaseId} */
export async function DELETE(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const releaseId = String(body.releaseId || "");
  const { error } = await db().from("films").delete().eq("release_id", releaseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
