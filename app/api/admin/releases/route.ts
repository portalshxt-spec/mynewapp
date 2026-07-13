import { NextResponse } from "next/server";
import { apiAdminSession } from "@/lib/auth";
import { isStripeConfigured, syncStripeForRelease } from "@/lib/stripe";
import { db } from "@/lib/supabase";
import { slugify } from "@/lib/utils";

export async function GET() {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db()
    .from("releases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ releases: data });
}

export async function POST(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    let slug = slugify(title);
    const { data: clash } = await db().from("releases").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const { data, error } = await db()
      .from("releases")
      .insert({ title, slug })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ release: data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export { syncRelease as PATCH };

/** PATCH /api/admin/releases  body: {id, ...fields} — update + auto-sync Stripe. */
async function syncRelease(req: Request) {
  if (!(await apiAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const allowed = [
      "title",
      "artwork",
      "description",
      "release_date",
      "published",
      "price_standard_cents",
      "price_deluxe_cents",
      "download_standard_key",
      "download_deluxe_key",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = body[key] === "" ? null : body[key];
    }

    const { data: updated, error } = await db()
      .from("releases")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Keep Stripe in sync whenever prices/title change.
    let stripeWarning: string | null = null;
    if (isStripeConfigured() && (updated.price_standard_cents || updated.price_deluxe_cents)) {
      try {
        const ids = await syncStripeForRelease(updated);
        const { data: final } = await db()
          .from("releases")
          .update({
            stripe_product_id: ids.productId,
            price_standard_id: ids.standardId,
            price_deluxe_id: ids.deluxeId,
          })
          .eq("id", id)
          .select("*")
          .single();
        return NextResponse.json({ release: final });
      } catch (e) {
        stripeWarning = e instanceof Error ? e.message : "Stripe sync failed";
      }
    } else if (!isStripeConfigured()) {
      stripeWarning = "Stripe is not configured — prices saved, checkout disabled.";
    }

    return NextResponse.json({ release: updated, stripeWarning });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
