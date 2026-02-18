/**
 * Phase 5.3 + 5.4: Generate caption for a planned post.
 * planned → draft; Extractor + Copywriter + Risk Checker.
 * Phase 5.4: Quota check (max 2 posts/platform/week) before generation.
 * PRD §5.1: User-initiated only; no auto-generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";
import { extractSignals } from "@/lib/extractor";
import { generateCaption } from "@/lib/copywriter";
import { checkCaption } from "@/lib/risk-checker";
import { checkGatekeeper } from "@/lib/gatekeeper";
import { checkPostQuota, incrementPostQuota } from "@/lib/quota";
import { canUserGenerate } from "@/lib/trial";

async function getAppUserId(session: { user: { id?: string; email?: string | null; name?: string | null } } | null) {
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
    .select("id, name, region, language, tone, category, city, state")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, platform, content_type, status, caption_text, week_start_date")
    .eq("id", postId)
    .eq("business_id", businessId)
    .single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const trial = await canUserGenerate(userId);
  if (!trial.allowed) {
    await recordEvent({ ownerType: "user", ownerId: userId }, "trial_blocked", { reason: trial.reason });
    if (trial.reason === "bind_card_required") {
      return NextResponse.json(
        { error: "bind_card_required", message: "Add payment to start 28-day free trial. 16 free posts included." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: trial.reason ?? "trial_expired", message: "Trial ended. Upgrade to continue." },
      { status: 403 }
    );
  }

  if (post.status !== "planned") {
    return NextResponse.json(
      { error: post.caption_text ? "Post already generated" : "Post is not in planned status" },
      { status: 400 }
    );
  }

  // Phase 5.4: Quota check — max 2 posts per platform per week
  const quota = await checkPostQuota(businessId, post.platform, post.week_start_date);
  if (!quota.allowed) {
    await recordEvent({ ownerType: "user", ownerId: userId }, "quota_hit", {
      business_id: businessId,
      platform: post.platform,
      week_start_date: post.week_start_date,
    });
    return NextResponse.json(
      { error: "quota_exceeded" },
      { status: 429 }
    );
  }

  // Fetch strategy and ingest for context
  const { data: strategy } = await supabaseAdmin
    .from("strategies")
    .select("strategy_text")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestIngest } = await supabaseAdmin
    .from("ingests")
    .select("redacted_text")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ingestText = latestIngest?.redacted_text ?? "";
  if (ingestText.trim()) {
    const gate = await checkGatekeeper(ingestText, {
      businessCategory: business.category ?? undefined,
      language: business.language ?? undefined,
    });
    if (!gate.allowed) {
      await recordEvent({ ownerType: "user", ownerId: userId }, "gatekeeper_blocked", {});
      return NextResponse.json({ error: "Please modify your input and try again." }, { status: 400 });
    }
  }

  const extractorSignals = await extractSignals({
    businessName: business.name,
    category: business.category,
    language: business.language ?? "en",
    tone: business.tone,
    ingestText: ingestText || undefined,
  });

  let caption = await generateCaption({
    extractorSignals,
    strategyText: strategy?.strategy_text ?? "",
    platform: post.platform,
    contentType: post.content_type ?? "tip",
    tone: business.tone,
    language: business.language ?? "en",
    businessName: business.name,
    city: business.city,
    state: business.state,
  });

  const riskResult = await checkCaption(caption);
  if (!riskResult.pass && riskResult.safeRewrite) {
    caption = riskResult.safeRewrite;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("posts")
    .update({
      status: "draft",
      caption_text: caption,
      risk_flags: riskResult.riskTags.length > 0 ? riskResult.riskTags : null,
    })
    .eq("id", postId)
    .eq("business_id", businessId);

  if (updateErr) {
    console.error("post generate update", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await incrementPostQuota(businessId, post.platform, post.week_start_date);

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "generate_clicked",
    { business_id: businessId, post_id: postId }
  );
  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "drafts_created",
    { business_id: businessId, post_id: postId }
  );
  if (riskResult.riskTags.length > 0) {
    await recordEvent(
      { ownerType: "user", ownerId: userId },
      "risk_flagged",
      { business_id: businessId, post_id: postId, risk_tags: riskResult.riskTags }
    );
  }

  return NextResponse.json({
    success: true,
    caption,
    riskFlags: riskResult.riskTags,
  });
}
