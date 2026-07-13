import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { db } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 600;

/** Returns a short-lived signed URL for one track, entitlement-checked. */
export async function GET(req: Request) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const trackId = url.searchParams.get("id") ?? "";
  const { data: track } = await db()
    .from("tracks")
    .select("id, release_id, audio_key")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    session.role === "admin" || (await hasEntitlement(session.email, track.release_id));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await db()
    .storage.from("audio")
    .createSignedUrl(track.audio_key, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
}
