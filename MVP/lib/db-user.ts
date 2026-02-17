import { supabaseAdmin } from "@/lib/supabase-server";

export type SessionUser = { id: string; email?: string | null; name?: string | null };

/** 是否为「列不存在」等 schema 错误（生产未跑 005 迁移时会出现） */
function isSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message ?? "");
  return code === "42703" || msg.includes("trial_ends_at") || msg.includes("does not exist");
}

/**
 * 根据 NextAuth session（Google sub）获取或创建本库 users 表记录，返回内部 user UUID。
 * 试用需先通过 Stripe 绑卡开启，不再在此处自动写入 trial_ends_at。
 * 若生产库未执行 005 迁移（无 trial_ends_at 列），会降级为仅查/插 id，避免白屏。
 */
export async function getOrCreateUser(sessionUser: SessionUser | null): Promise<{ id: string } | null> {
  if (!sessionUser?.id) return null;
  const authProviderId = sessionUser.id;

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("users")
    .select("id, trial_ends_at")
    .eq("auth_provider_id", authProviderId)
    .single();

  if (selectError && isSchemaError(selectError)) {
    const { data: fallback } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_provider_id", authProviderId)
      .single();
    return fallback ? { id: fallback.id } : null;
  }
  if (selectError && (selectError as { code?: string }).code !== "PGRST116") throw selectError;

  if (existing) return { id: existing.id };

  const insertPayload: Record<string, unknown> = {
    auth_provider_id: authProviderId,
    email: sessionUser.email ?? null,
    name: sessionUser.name ?? null,
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("users")
    .insert(insertPayload)
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
    if (isSchemaError(error)) {
      const { data: fallback } = await supabaseAdmin
        .from("users")
        .insert({
          auth_provider_id: authProviderId,
          email: sessionUser.email ?? null,
          name: sessionUser.name ?? null,
        })
        .select("id")
        .single();
      return fallback ? { id: fallback.id } : null;
    }
    throw error;
  }
  return inserted ? { id: inserted.id } : null;
}

/**
 * 服务端获取当前登录用户在本库中的 user id（用于 dashboard 等需要 userId 的页面）。
 */
export async function getCurrentAppUserId(session: { user?: { id?: string; email?: string | null; name?: string | null } } | null): Promise<string | null> {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
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
