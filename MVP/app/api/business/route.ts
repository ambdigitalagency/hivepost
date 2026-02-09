import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";

async function getAppUserId(session: { user: { id?: string; email?: string | null; name?: string | null } } | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/** 列出当前用户的业务 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, region, language, tone, category, city, state, postal_code, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ businesses: data ?? [] });
}

/** 创建业务 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; region?: string; language?: string; tone?: string; category?: string; city?: string; state?: string; postal_code?: string; website_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const region = body.region ?? "US";
  const language = body.language ?? "en";
  if (!["en", "zh"].includes(language)) {
    return NextResponse.json({ error: "language must be en or zh" }, { status: 400 });
  }

  const websiteUrl = typeof body.website_url === "string" && body.website_url.trim()
    ? body.website_url.trim().slice(0, 500)
    : null;

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .insert({
      user_id: userId,
      name: body.name ?? null,
      region,
      language,
      tone: body.tone ?? null,
      category: body.category ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      postal_code: body.postal_code ?? null,
      website_url: websiteUrl,
    })
    .select("id, name, region, language, tone, category, city, state, postal_code, created_at")
    .single();

  if (error) {
    console.error("business POST", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "onboarding_completed",
    { business_id: data.id }
  );
  return NextResponse.json(data);
}
