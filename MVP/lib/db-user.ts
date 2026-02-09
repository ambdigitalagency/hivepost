import { supabaseAdmin } from "@/lib/supabase-server";

export type SessionUser = { id: string; email?: string | null; name?: string | null };

/**
 * 根据 NextAuth session（Google sub）获取或创建本库 users 表记录，返回内部 user UUID。
 * 用于 API 中关联 businesses 等。
 */
export async function getOrCreateUser(sessionUser: SessionUser | null): Promise<{ id: string } | null> {
  if (!sessionUser?.id) return null;
  const authProviderId = sessionUser.id;

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("auth_provider_id", authProviderId)
    .single();

  if (existing) return { id: existing.id };

  const { data: inserted, error } = await supabaseAdmin
    .from("users")
    .insert({
      auth_provider_id: authProviderId,
      email: sessionUser.email ?? null,
      name: sessionUser.name ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("auth_provider_id", authProviderId)
        .single();
      return retry ? { id: retry.id } : null;
    }
    throw error;
  }
  return inserted ? { id: inserted.id } : null;
}

/**
 * 将用户的 first_used_at 设为当前时间（仅当尚未设置时）。
 * 用于「约 2 周后反馈」判断。当前在「选 2 平台保存成功」时调用；阶段 6 实现导出时需在首次导出/标记已使用时再调一次（幂等）。
 */
export async function setFirstUsedAt(userId: string): Promise<void> {
  await supabaseAdmin
    .from("users")
    .update({ first_used_at: new Date().toISOString() })
    .eq("id", userId)
    .is("first_used_at", null);
}
