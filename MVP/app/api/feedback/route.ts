/**
 * 提交反馈：rating 1–5，whats_good、what_to_improve 可选；写入 feedback 表并埋点 feedback_submitted。
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { rating: number; whats_good?: string; what_to_improve?: string; business_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  const whats_good = typeof body.whats_good === "string" ? body.whats_good.trim() || null : null;
  const what_to_improve =
    typeof body.what_to_improve === "string" ? body.what_to_improve.trim() || null : null;
  const business_id =
    typeof body.business_id === "string" && body.business_id.length > 0 ? body.business_id : null;

  const { error } = await supabaseAdmin.from("feedback").insert({
    user_id: userId,
    business_id,
    rating,
    whats_good,
    what_to_improve,
  });

  if (error) {
    console.error("feedback insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "feedback_submitted",
    { rating, business_id }
  );

  return NextResponse.json({ ok: true });
}
