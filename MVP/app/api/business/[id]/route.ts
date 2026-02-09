import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";

async function getAppUserId(session: { user: { id?: string; email?: string | null; name?: string | null } } | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/** 获取单个业务（仅本人） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, region, language, tone, category, city, state, postal_code, website_url, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/** 更新业务 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { name?: string; region?: string; language?: string; tone?: string; category?: string; city?: string; state?: string; postal_code?: string; website_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.language !== undefined && !["en", "zh"].includes(body.language)) {
    return NextResponse.json({ error: "language must be en or zh" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.region !== undefined) update.region = body.region;
  if (body.language !== undefined) update.language = body.language;
  if (body.tone !== undefined) update.tone = body.tone;
  if (body.category !== undefined) update.category = body.category;
  if (body.city !== undefined) update.city = body.city;
  if (body.state !== undefined) update.state = body.state;
  if (body.postal_code !== undefined) update.postal_code = body.postal_code;
  if (body.website_url !== undefined) update.website_url = typeof body.website_url === "string" ? body.website_url.trim().slice(0, 500) || null : null;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, name, region, language, tone, category, city, state, postal_code, website_url, created_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
