import { db } from "./supabase";
import type { Customer, Entitlement, Tier } from "./types";

export async function findOrCreateCustomer(
  email: string,
  stripeCustomerId?: string | null
): Promise<Customer> {
  const normalized = email.toLowerCase();
  const { data: existing } = await db()
    .from("customers")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();
  if (existing) {
    if (stripeCustomerId && !existing.stripe_customer_id) {
      await db().from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", existing.id);
    }
    return existing as Customer;
  }
  const { data, error } = await db()
    .from("customers")
    .insert({ email: normalized, stripe_customer_id: stripeCustomerId ?? null })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create customer: ${error.message}`);
  return data as Customer;
}

export async function grantEntitlement(opts: {
  email: string;
  releaseId: string;
  tier: Tier;
  source: string;
  amountCents?: number | null;
  currency?: string | null;
  stripeCustomerId?: string | null;
}): Promise<void> {
  const customer = await findOrCreateCustomer(opts.email, opts.stripeCustomerId);
  // Skip if an identical active entitlement already exists (webhook retries).
  const { data: existing } = await db()
    .from("entitlements")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("release_id", opts.releaseId)
    .eq("tier", opts.tier)
    .eq("source", opts.source)
    .is("revoked_at", null);
  if (existing && existing.length > 0) return;

  const { error } = await db().from("entitlements").insert({
    customer_id: customer.id,
    release_id: opts.releaseId,
    tier: opts.tier,
    source: opts.source,
    amount_cents: opts.amountCents ?? null,
    currency: opts.currency ?? "usd",
  });
  if (error) throw new Error(`Failed to grant entitlement: ${error.message}`);
}

/** Revoke every entitlement created by a given Stripe payment (refund handling). */
export async function revokeEntitlementsBySource(source: string): Promise<void> {
  await db()
    .from("entitlements")
    .update({ revoked_at: new Date().toISOString() })
    .eq("source", source)
    .is("revoked_at", null);
}

/** Active entitlements for an email. */
export async function entitlementsForEmail(email: string): Promise<Entitlement[]> {
  const { data: customer } = await db()
    .from("customers")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!customer) return [];
  const { data } = await db()
    .from("entitlements")
    .select("*")
    .eq("customer_id", customer.id)
    .is("revoked_at", null);
  return (data as Entitlement[]) ?? [];
}

export async function hasEntitlement(
  email: string,
  releaseId: string,
  tier?: Tier
): Promise<boolean> {
  const ents = await entitlementsForEmail(email);
  return ents.some((e) => e.release_id === releaseId && (tier ? e.tier === tier : true));
}

export async function hasAnyEntitlement(email: string): Promise<boolean> {
  const ents = await entitlementsForEmail(email);
  return ents.length > 0;
}
