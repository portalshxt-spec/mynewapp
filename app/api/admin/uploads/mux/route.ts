import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { createDirectUpload, getUpload, isMuxConfigured } from "@/lib/mux";
import { siteUrl } from "@/lib/env";

/** POST — mint a Mux direct-upload URL. body: {policy: 'public'|'signed'} */
export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMuxConfigured()) {
    return NextResponse.json({ error: "Mux is not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const policy = body.policy === "signed" ? "signed" : "public";
    const upload = await createDirectUpload(policy, siteUrl());
    return NextResponse.json(upload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mux upload failed" },
      { status: 500 }
    );
  }
}

/** GET ?id=uploadId — poll until the uploaded file becomes a ready asset. */
export async function GET(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uploadId = new URL(req.url).searchParams.get("id") ?? "";
  if (!uploadId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const upload = await getUpload(uploadId);
    return NextResponse.json({
      status: upload.status,
      assetId: upload.asset_id ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mux poll failed" },
      { status: 500 }
    );
  }
}
