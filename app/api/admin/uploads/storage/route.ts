import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { safeFilename } from "@/lib/utils";

const BUCKETS = new Set(["artwork", "audio", "downloads"]);

/**
 * POST — mint a signed upload URL so the admin browser uploads straight to
 * storage (large audio/zip files never pass through the app server).
 * body: {bucket, filename, folder?}
 */
export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const bucket = String(body.bucket || "");
    if (!BUCKETS.has(bucket)) return NextResponse.json({ error: "Bad bucket" }, { status: 400 });

    const folder = String(body.folder || "misc").replace(/[^a-zA-Z0-9/_-]/g, "");
    const path = `${folder}/${crypto.randomUUID()}-${safeFilename(String(body.filename || "file"))}`;

    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
    }

    // Public URL only exists for the public artwork bucket.
    const publicUrl =
      bucket === "artwork" ? db().storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

    return NextResponse.json({ bucket, path, token: data.token, publicUrl });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
