/**
 * Trial & subscription access — 免费试用一个月，超期需订阅
 * 在所有「生成文案」「生成候选图」「最终化」入口校验。
 */

import { supabaseAdmin } from "./supabase-server";

const TRIAL_DAYS = 28;

export type TrialStatus = {
  allowed: boolean;
  reason?: "trial_expired" | "no_trial" | "bind_card_required";
  trialEndsAt: string | null;
  subscriptionActive: boolean;
  daysLeft: number | null;
};

/** 用户已生成过的帖子数（caption 已生成，status 非 planned） */
export async function getGeneratedPostCount(userId: string): Promise<number> {
  try {
    const { data: bizIds } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("user_id", userId);
    if (!bizIds?.length) return 0;
    const ids = bizIds.map((b) => b.id);
    const { count } = await supabaseAdmin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .in("business_id", ids)
      .in("status", ["draft", "images_pending", "ready", "used"]);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 若 trial_ends_at 为 NULL，设为当前 + 28 天（仅写一次）。
 * 在首次登录（getOrCreateUser 拿到已有用户）或首次创建业务时调用。
 */
export async function ensureTrialStarted(userId: string): Promise<void> {
  try {
    const end = new Date();
    end.setDate(end.getDate() + TRIAL_DAYS);
    await supabaseAdmin
      .from("users")
      .update({ trial_ends_at: end.toISOString() })
      .eq("id", userId)
      .is("trial_ends_at", null);
  } catch (err) {
    if (isSchemaError(err)) return;
    throw err;
  }
}

/** 是否为「列/表不存在」等 schema 错误（未跑 005 迁移时会出现） */
function isSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message ?? "");
  return code === "42703" || code === "42P01" || msg.includes("does not exist") || msg.includes("column");
}

/**
 * 检查用户是否在试用期内或有有效订阅；若不允许则返回原因。
 * 若数据库未执行 005 迁移（缺 trial_ends_at / subscriptions），返回允许访问的默认状态，避免白屏。
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  try {
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
      allowed: false,
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
  } catch (err) {
    if (isSchemaError(err)) {
      return {
        allowed: true,
        trialEndsAt: null,
        subscriptionActive: false,
        daysLeft: null,
        reason: "no_trial",
      };
    }
    throw err;
  }
}

/**
 * 是否允许该用户进行「生成文案 / 候选图 / 最终化」。
 * 第一条免费；第二条起需绑卡开试用（28 天，16 条）。试用期内或有效订阅为 true。
 */
export async function canUserGenerate(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const generatedCount = await getGeneratedPostCount(userId);
  if (generatedCount === 0) return { allowed: true }; // 第一条免费

  const status = await getTrialStatus(userId);
  if (status.allowed) return { allowed: true };
  return {
    allowed: false,
    reason: status.reason === "trial_expired" ? "trial_expired" : "bind_card_required",
  };
}
