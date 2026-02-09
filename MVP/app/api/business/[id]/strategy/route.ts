import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateStrategy } from "@/lib/strategy-generator";
import { recordEvent } from "@/lib/events";

async function getAppUserId(session: { user?: { id?: string; email?: string | null; name?: string | null } } | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/** GET：获取该业务最新一条策略 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { data: strategy, error } = await supabaseAdmin
    .from("strategies")
    .select("id, strategy_text, recommended_platforms, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!strategy) return NextResponse.json(null);

  return NextResponse.json({
    id: strategy.id,
    strategyText: strategy.strategy_text,
    recommendedPlatforms: strategy.recommended_platforms ?? [],
    createdAt: strategy.created_at,
  });
}

/** POST：生成策略并写入 strategies 表 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;
  const { data: business, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("id, name, region, language, tone, category, website_url")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { data: latestIngest } = await supabaseAdmin
    .from("ingests")
    .select("redacted_text")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const output = await generateStrategy({
    businessName: business.name,
    category: business.category,
    region: business.region ?? "US",
    language: business.language ?? "en",
    tone: business.tone,
    ingestText: latestIngest?.redacted_text ?? undefined,
    websiteUrl: business.website_url ?? undefined,
  });

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("strategies")
    .insert({
      business_id: businessId,
      strategy_text: output.strategyText,
      recommended_platforms: output.recommendedPlatforms,
    })
    .select("id, created_at")
    .single();

  if (insertErr) {
    console.error("strategies insert", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "strategy_generated",
    { business_id: businessId, strategy_id: row.id }
  );

  return NextResponse.json({
    id: row.id,
    strategyText: output.strategyText,
    recommendedPlatforms: output.recommendedPlatforms,
    createdAt: row.created_at,
  });
}
