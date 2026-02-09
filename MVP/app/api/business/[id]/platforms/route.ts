import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser, setFirstUsedAt } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";

const MAX_PLATFORMS = 2;
const ALLOWED_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "nextdoor",
  "google_business_profile",
  "xiaohongshu",
  "wechat_moments",
]);

/** Map display names / LLM variants to canonical platform key */
const PLATFORM_ALIASES: Record<string, string> = {
  xiaohongshu: "xiaohongshu",
  小红书: "xiaohongshu",
  wechat_moments: "wechat_moments",
  "wechat moments": "wechat_moments",
  "WeChat Moments": "wechat_moments",
  "Wechat moments": "wechat_moments",
  微信朋友圈: "wechat_moments",
  instagram: "instagram",
  facebook: "facebook",
  nextdoor: "nextdoor",
  "google business profile": "google_business_profile",
  "google_business_profile": "google_business_profile",
};

function toCanonicalPlatform(p: string): string {
  const trimmed = p.trim();
  const aliased = PLATFORM_ALIASES[trimmed];
  if (aliased) return aliased;
  const normalized = trimmed.toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_ALIASES[normalized] ?? normalized;
}

async function getAppUserId(session: { user: { id?: string; email?: string | null; name?: string | null } } | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/** 设置该业务的平台（最多 2 个）。body: { platforms: string[] } */
export async function POST(
  req: NextRequest,
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

  let body: { platforms?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.platforms;
  if (!Array.isArray(raw) || raw.length > MAX_PLATFORMS) {
    return NextResponse.json(
      { error: `platforms must be an array with at most ${MAX_PLATFORMS} items` },
      { status: 400 }
    );
  }

  const platforms = Array.from(
    new Set(raw.filter((p) => typeof p === "string").map((p) => toCanonicalPlatform(p as string)))
  ).filter((p) => ALLOWED_PLATFORMS.has(p));
  if (platforms.length !== raw.length) {
    return NextResponse.json(
      { error: `Each platform must be one of: ${Array.from(ALLOWED_PLATFORMS).join(", ")}` },
      { status: 400 }
    );
  }
  if (platforms.length === 0) {
    return NextResponse.json({ error: "Select at least one platform" }, { status: 400 });
  }

  const { data: strategy } = await supabaseAdmin
    .from("strategies")
    .select("recommended_platforms")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const recs = (strategy?.recommended_platforms as string[] | null) ?? [];
  const normalizedRecs = recs
    .filter((p): p is string => typeof p === "string")
    .map((p) => toCanonicalPlatform(p))
    .filter((p) => ALLOWED_PLATFORMS.has(p));
  const allowedSet = normalizedRecs.length > 0 ? new Set(normalizedRecs) : ALLOWED_PLATFORMS;
  const invalid = platforms.filter((p) => !allowedSet.has(p.toLowerCase()));
  if (invalid.length > 0 && platforms.some((p) => !ALLOWED_PLATFORMS.has(p.toLowerCase()))) {
    return NextResponse.json(
      { error: "Selected platforms must be from your strategy recommendations" },
      { status: 400 }
    );
  }

  await supabaseAdmin.from("business_platforms").delete().eq("business_id", businessId);

  if (platforms.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from("business_platforms").insert(
      platforms.map((platform) => ({ business_id: businessId, platform }))
    );
    if (insertErr) {
      console.error("business_platforms insert", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  const { data: list } = await supabaseAdmin
    .from("business_platforms")
    .select("id, platform")
    .eq("business_id", businessId)
    .order("platform");

  await setFirstUsedAt(userId);
  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "platforms_selected",
    { business_id: businessId, platforms: list ?? [] }
  );

  return NextResponse.json({ platforms: list ?? [] });
}

/** 获取该业务的已选平台 */
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

  const { data, error } = await supabaseAdmin
    .from("business_platforms")
    .select("id, platform")
    .eq("business_id", businessId)
    .order("platform");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ platforms: data ?? [] });
}
