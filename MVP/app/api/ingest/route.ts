import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkGatekeeper } from "@/lib/gatekeeper";
import { redactPii } from "@/lib/pii-scrubber";
import { recordEvent } from "@/lib/events";

async function getAppUserId(session: {
  user?: { id?: string; email?: string | null; name?: string | null };
} | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/**
 * POST /api/ingest
 * Body: { businessId: string, text: string }
 * 流程：Gatekeeper 校验 -> PII 脱敏 -> 写入 ingests。
 * 拦截时返回 400，code: GATEKEEPER_BLOCKED，message 由前端用 common.gatekeeperBlock 展示。
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { businessId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const businessId = body.businessId;
  const text = typeof body.text === "string" ? body.text : "";

  if (!businessId?.trim()) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  // 空内容视为跳过：不写入 ingest，直接返回成功（前端可跳转下一步）
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ ingestId: null, skipped: true });
  }

  // 校验业务归属
  const { data: business, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("id, category, language")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Gatekeeper：先校验再脱敏
  const gate = await checkGatekeeper(trimmed, {
    businessCategory: business.category ?? undefined,
    language: business.language ?? undefined,
  });

  if (!gate.allowed) {
    await recordEvent(
      { ownerType: "user", ownerId: userId },
      "gatekeeper_blocked",
      { business_id: businessId }
    );
    return NextResponse.json(
      {
        code: "GATEKEEPER_BLOCKED",
        message: "Please modify your input and try again.",
      },
      { status: 400 }
    );
  }

  const redacted = redactPii(trimmed);

  const { data: row, error } = await supabaseAdmin
    .from("ingests")
    .insert({
      business_id: businessId,
      redacted_text: redacted,
    })
    .select("id")
    .single();

  if (error) {
    console.error("ingest POST", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "ingest_submitted",
    { business_id: businessId, ingest_id: row.id }
  );

  return NextResponse.json({ ingestId: row.id });
}
