import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** POST — create a track row after its audio file has been uploaded to storage. */
export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const releaseId = String(body.releaseId || "");
    const title = String(body.title || "").trim();
    const audioKey = String(body.audioKey || "");
    const duration = Number.isFinite(body.duration) ? Math.round(body.duration) : null;
    if (!releaseId || !title || !audioKey) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: last } = await db()
      .from("tracks")
      .select("position")
      .eq("release_id", releaseId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? -1) + 1;

    const { data, error } = await db()
      .from("tracks")
      .insert({ release_id: releaseId, title, audio_key: audioKey, duration, position })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ track: data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** PATCH — reorder: body {releaseId, order: [trackId,...]} */
export async function PATCH(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const releaseId = String(body.releaseId || "");
    const order: string[] = Array.isArray(body.order) ? body.order : [];
    if (!releaseId || order.length === 0) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await Promise.all(
      order.map((trackId, i) =>
        db().from("tracks").update({ position: i }).eq("id", trackId).eq("release_id", releaseId)
      )
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
