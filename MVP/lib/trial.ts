/**
 * Trial & subscription access — 免费试用一个月，超期需订阅
 * 在所有「生成文案」「生成候选图」「最终化」入口校验。
 */

import { supabaseAdmin } from "./supabase-server";

const TRIAL_DAYS = 30;

export type TrialStatus = {
  allowed: boolean;
  reason?: "trial_expired" | "no_trial";
  trialEndsAt: string | null;
  subscriptionActive: boolean;
  daysLeft: number | null;
};

/**
 * 若 trial_ends_at 为 NULL，设为当前 + 30 天（仅写一次）。
 * 在首次登录（getOrCreateUser 拿到已有用户）或首次创建业务时调用。
 */
export async function ensureTrialStarted(userId: string): Promise<void> {
  const end = new Date();
  end.setDate(end.getDate() + TRIAL_DAYS);
  await supabaseAdmin
    .from("users")
    .update({ trial_ends_at: end.toISOString() })
    .eq("id", userId)
    .is("trial_ends_at", null);
}

/**
 * 检查用户是否在试用期内或有有效订阅；若不允许则返回原因。
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("trial_ends_at")
    .eq("id", userId)
    .single();

  const trialEndsAt = user?.trial_ends_at ?? null;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", userId)
    .in("status", ["trial", "active", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionActive = !!sub && (sub.current_period_end ? new Date(sub.current_period_end) > new Date() : true);

  if (subscriptionActive) {
    const daysLeft = sub?.current_period_end
      ? Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;
    return {
      allowed: true,
      trialEndsAt,
      subscriptionActive: true,
      daysLeft,
    };
  }

  if (!trialEndsAt) {
    return {
      allowed: true,
      trialEndsAt: null,
      subscriptionActive: false,
      daysLeft: null,
      reason: "no_trial",
    };
  }

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (end <= now) {
    return {
      allowed: false,
      reason: "trial_expired",
      trialEndsAt,
      subscriptionActive: false,
      daysLeft: 0,
    };
  }

  return {
    allowed: true,
    trialEndsAt,
    subscriptionActive: false,
    daysLeft,
  };
}

/**
 * 是否允许该用户进行「生成文案 / 候选图 / 最终化」。
 * 试用期内或有效订阅期内为 true；试用结束且无订阅为 false。
 */
export async function canUserGenerate(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getTrialStatus(userId);
  if (status.allowed) return { allowed: true };
  return {
    allowed: false,
    reason: status.reason === "trial_expired" ? "trial_expired" : "upgrade_required",
  };
}
