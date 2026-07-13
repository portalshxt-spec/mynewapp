import Stripe from "stripe";
import { env, optionalEnv } from "./env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(env("STRIPE_SECRET_KEY"));
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(optionalEnv("STRIPE_SECRET_KEY"));
}

/**
 * Ensure a Stripe product + prices exist for a release.
 * Stripe prices are immutable, so a changed amount creates a new price and
 * the release row stores the new id. Returns the ids to persist.
 */
export async function syncStripeForRelease(release: {
  id: string;
  title: string;
  stripe_product_id: string | null;
  price_standard_id: string | null;
  price_deluxe_id: string | null;
  price_standard_cents: number | null;
  price_deluxe_cents: number | null;
}): Promise<{ productId: string; standardId: string | null; deluxeId: string | null }> {
  const s = stripe();

  let productId = release.stripe_product_id;
  if (productId) {
    await s.products.update(productId, { name: release.title }).catch(() => {});
  } else {
    const product = await s.products.create({
      name: release.title,
      metadata: { release_id: release.id },
    });
    productId = product.id;
  }

  async function ensurePrice(
    existingId: string | null,
    cents: number | null,
    tier: "standard" | "deluxe"
  ): Promise<string | null> {
    if (!cents || cents <= 0) return existingId;
    if (existingId) {
      try {
        const price = await s.prices.retrieve(existingId);
        if (price.unit_amount === cents && price.active) return existingId;
      } catch {
        // fall through and create a fresh price
      }
    }
    const price = await s.prices.create({
      product: productId!,
      unit_amount: cents,
      currency: "usd",
      nickname: tier,
      metadata: { release_id: release.id, tier },
    });
    return price.id;
  }

  const standardId = await ensurePrice(release.price_standard_id, release.price_standard_cents, "standard");
  const deluxeId = await ensurePrice(release.price_deluxe_id, release.price_deluxe_cents, "deluxe");

  return { productId: productId!, standardId, deluxeId };
}
