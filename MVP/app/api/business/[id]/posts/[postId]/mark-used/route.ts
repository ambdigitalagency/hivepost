/**
 * Phase 6.4: 标记该条内容已使用（导出完成）。
 * 更新 post 为 exported、exported_at；若用户首次完成导出则更新 first_used_at 并返回 firstTimeUse。
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser, setFirstUsedAt } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";

async function getAppUserId(session: {
  user?: { id?: string; email?: string | null; name?: string | null };
} | null): Promise<string | null> {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId, postId } = await params;

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .eq("business_id", businessId)
    .single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "ready") {
    return NextResponse.json(
      { error: "Post must be ready (with final images) to mark as used" },
      { status: 400 }
    );
  }

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("first_used_at")
    .eq("id", userId)
    .single();
  const wasFirstUse = userRow?.first_used_at == null;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("posts")
    .update({ status: "exported", exported_at: now })
    .eq("id", postId)
    .eq("business_id", businessId);

  await setFirstUsedAt(userId);

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    wasFirstUse ? "first_use_completed" : "export_clicked",
    { business_id: businessId, post_id: postId }
  );
  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "marked_used",
    { business_id: businessId, post_id: postId }
  );

  return NextResponse.json({
    success: true,
    firstTimeUse: wasFirstUse,
  });
}
