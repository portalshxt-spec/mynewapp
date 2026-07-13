import { NextResponse } from "next/server";
import { getReleaseById } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Checkout is not configured yet" }, { status: 503 });
    }
    const body = await req.json();
    const releaseId = String(body.releaseId || "");
    const tier = body.tier === "deluxe" ? "deluxe" : "standard";

    const release = await getReleaseById(releaseId);
    if (!release || !release.published) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }
    const priceId = tier === "deluxe" ? release.price_deluxe_id : release.price_standard_id;
    if (!priceId) {
      return NextResponse.json({ error: "This edition is not on sale" }, { status: 400 });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl()}/store/${release.slug}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/store/${release.slug}`,
      customer_creation: "always",
      allow_promotion_codes: true,
      metadata: { release_id: release.id, tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout error", e);
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
