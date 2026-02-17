import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

const EXPIRES_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Create a verification token for the user, store hash in DB, return raw token for the link.
 */
export async function createVerificationToken(userId: string, email: string): Promise<string | null> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000);
  const { error } = await supabaseAdmin.from("email_verification_tokens").insert({
    user_id: userId,
    email,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return null;
  return raw;
}

/**
 * Consume token: find by hash, check expiry, set users.email_verified_at, delete token. Returns user id or null.
 */
export async function verifyTokenAndMarkEmailVerified(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const { data: row, error: findErr } = await supabaseAdmin
    .from("email_verification_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", tokenHash)
    .single();
  if (findErr || !row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  await supabaseAdmin.from("email_verification_tokens").delete().eq("id", row.id);
  const { error: updateErr } = await supabaseAdmin
    .from("users")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", row.user_id);
  if (updateErr) return null;
  return row.user_id;
}
