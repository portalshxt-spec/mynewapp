import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getReleaseById } from "@/lib/data";
import { isEmailConfigured, sendPurchaseEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { grantEntitlement, revokeEntitlementsBySource } from "@/lib/entitlements";
import { stripe } from "@/lib/stripe";
import { createMagicToken } from "@/lib/tokens";

export async function POST(req: Request) {
  let event: Stripe.Event;
  try {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";
    event = await stripe().webhooks.constructEventAsync(
      payload,
      signature,
      env("STRIPE_WEBHOOK_SECRET")
    );
  } catch (e) {
    console.error("webhook signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") break;

        const email = session.customer_details?.email ?? session.customer_email;
        const releaseId = session.metadata?.release_id;
        const tier = session.metadata?.tier === "deluxe" ? "deluxe" : "standard";
        if (!email || !releaseId) break;

        const source =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? session.id;

        await grantEntitlement({
          email,
          releaseId,
          tier,
          source,
          amountCents: session.amount_total,
          currency: session.currency,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        });

        // Email the buyer their way in.
        if (isEmailConfigured()) {
          const release = await getReleaseById(releaseId);
          const token = await createMagicToken(email, "member");
          await sendPurchaseEmail(email, token, release?.title ?? "your release", tier);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (pi) await revokeEntitlementsBySource(pi);
        break;
      }
    }
  } catch (e) {
    console.error("webhook handler error", e);
    // 500 so Stripe retries — grants must not be silently lost.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
