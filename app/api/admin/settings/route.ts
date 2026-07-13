import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";

const EDITABLE_KEYS = new Set([
  "tagline",
  "hero_line",
  "signup_header",
  "signup_subtext",
  "footer_text",
  "lore_title",
  "lore_text",
  "band_members",
]);

export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_KEYS.has(key) && typeof value === "string") entries[key] = value;
    }
    if (Object.keys(entries).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    await updateSettings(entries);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
