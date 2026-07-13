import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [{ data: release }, { data: tracks }, { data: film }] = await Promise.all([
    db().from("releases").select("*").eq("id", id).maybeSingle(),
    db().from("tracks").select("*").eq("release_id", id).order("position"),
    db().from("films").select("*").eq("release_id", id).maybeSingle(),
  ]);
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ release, tracks: tracks ?? [], film });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { error } = await db().from("releases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
