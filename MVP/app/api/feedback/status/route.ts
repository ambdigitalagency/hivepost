/**
 * 是否展示「约 2 周后」反馈邀请：
 * first_used_at 已存在且距今 >= 14 天，且该用户尚未提交过反馈。
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const FEEDBACK_INVITATION_DAYS = Number(process.env.FEEDBACK_INVITATION_DAYS) || 14;

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ showFeedbackInvitation: false });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("first_used_at")
    .eq("id", userId)
    .single();

  if (!user?.first_used_at) {
    return NextResponse.json({ showFeedbackInvitation: false });
  }

  const firstUsed = new Date(user.first_used_at).getTime();
  const now = Date.now();
  const daysSinceFirstUse = (now - firstUsed) / (24 * 60 * 60 * 1000);
  if (daysSinceFirstUse < FEEDBACK_INVITATION_DAYS) {
    return NextResponse.json({ showFeedbackInvitation: false });
  }

  const { count } = await supabaseAdmin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return NextResponse.json({
    showFeedbackInvitation: (count ?? 0) === 0,
  });
}
