/**
 * Quota service — PRD §4.3, §10.1
 * Max 2 posts per platform per week.
 * Uses weekly_quota_usage table.
 */

import { supabaseAdmin } from "./supabase-server";

const POSTS_PER_PLATFORM_PER_WEEK = 2;

/**
 * Check if business can generate one more post for this platform in this week.
 * Returns { allowed: boolean, used: number, limit: number }.
 */
export async function checkPostQuota(
  businessId: string,
  platform: string,
  weekStartDate: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { data } = await supabaseAdmin
    .from("weekly_quota_usage")
    .select("posts_used_count")
    .eq("business_id", businessId)
    .eq("platform_type", platform)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  const used = data?.posts_used_count ?? 0;
  const allowed = used < POSTS_PER_PLATFORM_PER_WEEK;
  return { allowed, used, limit: POSTS_PER_PLATFORM_PER_WEEK };
}

/**
 * Increment posts_used_count for this business/platform/week after successful generation.
 */
export async function incrementPostQuota(
  businessId: string,
  platform: string,
  weekStartDate: string
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("weekly_quota_usage")
    .select("id, posts_used_count")
    .eq("business_id", businessId)
    .eq("platform_type", platform)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabaseAdmin
      .from("weekly_quota_usage")
      .update({
        posts_used_count: existing.posts_used_count + 1,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("weekly_quota_usage").insert({
      business_id: businessId,
      platform_type: platform,
      week_start_date: weekStartDate,
      posts_used_count: 1,
      updated_at: now,
    });
  }
}

/** Get Monday 00:00 UTC for a given week */
function getWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/** Days until next Monday (0 = today is Monday, 1-6 = days until next) */
function daysUntilReset(): number {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0) return 1;
  if (day === 1) return 7;
  return 8 - day;
}

/** Get quota summary for a business's platforms (current week). */
export async function getQuotaSummary(
  businessId: string,
  platformKeys: string[]
): Promise<{ platform: string; used: number; limit: number }[]> {
  const weekStart = getWeekStart(new Date());
  const results = await Promise.all(
    platformKeys.map(async (platform) => {
      const { used, limit } = await checkPostQuota(businessId, platform, weekStart);
      return { platform, used, limit };
    })
  );
  return results;
}

export { daysUntilReset };
