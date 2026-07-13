import { createHash, randomBytes } from "crypto";
import { db } from "./supabase";

const TOKEN_TTL_HOURS = 24;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a single-use magic token and return the raw token (only ever exists in the email link). */
export async function createMagicToken(email: string, purpose: "member" | "admin"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await db().from("magic_tokens").insert({
    email: email.toLowerCase(),
    token_hash: hash(token),
    purpose,
    expires_at: expires,
  });
  if (error) throw new Error(`Failed to create magic token: ${error.message}`);
  return token;
}

/** Verify and consume a magic token. Returns the email + purpose, or null if invalid/expired/used. */
export async function consumeMagicToken(
  token: string
): Promise<{ email: string; purpose: "member" | "admin" } | null> {
  const { data, error } = await db()
    .from("magic_tokens")
    .select("*")
    .eq("token_hash", hash(token))
    .maybeSingle();
  if (error || !data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  // Mark used atomically-ish: only succeed if still unused.
  const { data: updated } = await db()
    .from("magic_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id");
  if (!updated || updated.length === 0) return null;

  return { email: data.email.toLowerCase(), purpose: data.purpose };
}
