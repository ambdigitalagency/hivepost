/**
 * Budget service — PRD §预算：全局 API 预算 $100/月，降级阶梯
 * 使用 api_cost_ledger 表；按当月累计花费决定是否允许及候选图数量。
 */

import { supabaseAdmin } from "./supabase-server";

const MONTHLY_CAP_USD = 100;

/** 当前月（UTC）起止时间 */
function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * 当月已花费（全局，所有 owner 合计）
 */
export async function getMonthlySpendUsd(): Promise<number> {
  const { from, to } = getCurrentMonthRange();
  const { data, error } = await supabaseAdmin
    .from("api_cost_ledger")
    .select("cost_usd_estimated")
    .gte("created_at", from)
    .lte("created_at", to);
  if (error) {
    console.error("getMonthlySpendUsd", error);
    return 0;
  }
  const sum = (data ?? []).reduce((acc, row) => acc + Number(row.cost_usd_estimated), 0);
  return Math.round(sum * 1e6) / 1e6;
}

export type BudgetCheckResult = {
  allowed: boolean;
  reason?: string;
  /** 本请求允许的候选图数量（降级阶梯：20 -> 10） */
  candidateCount: number;
  spendUsd: number;
  capUsd: number;
};

/**
 * 检查是否可以发起「生成候选图」及允许的候选数量。
 * 降级阶梯：剩余 >= 15 用 30 张，>= 5 用 20 张，否则 10 张；超限拒绝。
 */
export async function checkBudgetForCandidates(): Promise<BudgetCheckResult> {
  const spendUsd = await getMonthlySpendUsd();
  const capUsd = MONTHLY_CAP_USD;
  if (spendUsd >= capUsd) {
    return {
      allowed: false,
      reason: "Monthly API budget reached.",
      candidateCount: 0,
      spendUsd,
      capUsd,
    };
  }
  const remaining = capUsd - spendUsd;
  const candidateCount = Math.min(remaining >= 15 ? 30 : remaining >= 5 ? 20 : 10, 20);
  return {
    allowed: true,
    candidateCount,
    spendUsd,
    capUsd,
  };
}

/** 是否允许该帖再请求「新一批」候选图（已有 >= 1 批时由降级阶梯决定） */
export async function checkBudgetForNewBatch(existingBatchCount: number): Promise<{ allowed: boolean; reason?: string }> {
  if (existingBatchCount <= 0) return { allowed: true };
  const spendUsd = await getMonthlySpendUsd();
  if (spendUsd >= MONTHLY_CAP_USD) return { allowed: false, reason: "Monthly API budget reached." };
  const remaining = MONTHLY_CAP_USD - spendUsd;
  if (remaining < 5) return { allowed: false, reason: "Budget too low for a new batch." };
  return { allowed: true };
}

/** 当月最终化允许的最大张数（降级：9 -> 6 -> 3） */
export async function getFinalizeMaxCount(): Promise<number> {
  const spendUsd = await getMonthlySpendUsd();
  if (spendUsd >= MONTHLY_CAP_USD) return 0;
  const remaining = MONTHLY_CAP_USD - spendUsd;
  if (remaining >= 10) return 10;
  if (remaining >= 5) return 6;
  return 3;
}

export type FinalizeBudgetResult = {
  allowed: boolean;
  reason?: string;
  maxFinalCount: number;
};

/** 检查是否有足够预算做最终化，并返回本请求允许的最大最终图数。 */
export async function checkBudgetForFinalize(selectedCount: number): Promise<FinalizeBudgetResult> {
  const maxFinalCount = await getFinalizeMaxCount();
  if (maxFinalCount <= 0) {
    return { allowed: false, reason: "Monthly API budget reached.", maxFinalCount: 0 };
  }
  if (selectedCount <= 0) return { allowed: false, reason: "No images selected", maxFinalCount };
  if (selectedCount > maxFinalCount) {
    return {
      allowed: false,
      reason: `At most ${maxFinalCount} images can be finalized (budget ladder).`,
      maxFinalCount,
    };
  }
  return { allowed: true, maxFinalCount };
}

export type RecordCostParams = {
  ownerType: "user" | "session";
  ownerId: string;
  provider: string;
  kind: "text" | "image";
  model?: string | null;
  units?: number | null;
  costUsdEstimated: number;
  requestId?: string | null;
};

/**
 * 记录一笔 API 成本到 api_cost_ledger
 */
export async function recordCost(params: RecordCostParams): Promise<void> {
  await supabaseAdmin.from("api_cost_ledger").insert({
    owner_type: params.ownerType,
    owner_id: params.ownerId,
    provider: params.provider,
    kind: params.kind,
    model: params.model ?? null,
    units: params.units ?? null,
    cost_usd_estimated: params.costUsdEstimated,
    request_id: params.requestId ?? null,
  });
}
