import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { db } from "@/lib/supabase";
import type { Release } from "@/lib/types";

const SIGNED_URL_TTL_SECONDS = 600;

/** Redirects to a short-lived signed URL for the release zip, entitlement-checked. */
export async function GET(req: Request) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const releaseId = url.searchParams.get("release") ?? "";
  const tier = url.searchParams.get("tier") === "deluxe" ? "deluxe" : "standard";

  const { data } = await db().from("releases").select("*").eq("id", releaseId).maybeSingle();
  const release = data as Release | null;
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The deluxe zip requires deluxe; the standard zip is included with any tier.
  const allowed =
    session.role === "admin" ||
    (tier === "deluxe"
      ? await hasEntitlement(session.email, release.id, "deluxe")
      : await hasEntitlement(session.email, release.id));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = tier === "deluxe" ? release.download_deluxe_key : release.download_standard_key;
  if (!key) return NextResponse.json({ error: "No download available" }, { status: 404 });

  const { data: signed, error } = await db()
    .storage.from("downloads")
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS, { download: true });
  if (error || !signed) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
