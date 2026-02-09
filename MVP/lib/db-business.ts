import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";

/** 服务端：获取当前用户的业务列表（含平台数）。无 session 返回 null。 */
export async function getMyBusinesses() {
  const session = await getServerSession(authOptions);
  const user = await getOrCreateUser(
    session?.user
      ? {
          id: session.user.id!,
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
        }
      : null
  );
  if (!user) return null;

  const { data: businesses, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, region, language, tone, category, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return null;

  const withPlatformCount = await Promise.all(
    (businesses ?? []).map(async (b) => {
      const { count } = await supabaseAdmin
        .from("business_platforms")
        .select("id", { count: "exact", head: true })
        .eq("business_id", b.id);
      return { ...b, platformCount: count ?? 0 };
    })
  );

  return withPlatformCount;
}
