import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  const { data, error } = await db().from("tracks").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ track: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  // Remove the audio file too so the bucket doesn't collect orphans.
  const { data: track } = await db().from("tracks").select("audio_key").eq("id", id).maybeSingle();
  const { error } = await db().from("tracks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (track?.audio_key) {
    await db().storage.from("audio").remove([track.audio_key]);
  }
  return NextResponse.json({ ok: true });
}
