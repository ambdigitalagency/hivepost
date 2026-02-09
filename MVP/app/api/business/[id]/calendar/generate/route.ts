import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";

const CONTENT_TYPES = ["tip", "faq", "story", "offer"] as const;

async function getAppUserId(session: { user: { id?: string; email?: string | null; name?: string | null } } | null) {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

/** Get Monday 00:00 UTC for a given week */
function getWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/**
 * Generate one month of content calendar (planned posts).
 * PRD: max 2 posts/platform/week, 2 platforms = 4 posts/week, ~16 posts/month.
 * Calendar is planned only; no content is auto-generated (user-initiated retention design).
 */
export async function POST(
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

  const { data: platforms } = await supabaseAdmin
    .from("business_platforms")
    .select("platform")
    .eq("business_id", businessId)
    .order("platform");
  if (!platforms || platforms.length === 0) {
    return NextResponse.json({ error: "Select 2 platforms first" }, { status: 400 });
  }

  // Idempotent: if calendar already has planned posts, skip
  const { data: existing } = await supabaseAdmin
    .from("posts")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "planned")
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ calendarGenerated: true, message: "Calendar already exists" });
  }

  const platformList = platforms.map((p) => p.platform);
  const now = new Date();
  const weekStart = getWeekStart(now);
  const rows: Array<{
    business_id: string;
    platform: string;
    week_start_date: string;
    scheduled_date: string;
    content_type: string;
    status: "planned";
  }> = [];

  let contentTypeIndex = 0;
  const daysPerPlatform: number[][] =
    platformList.length >= 2 ? [[2, 4], [3, 5]] : [[2, 4]]; // Tue/Thu, Wed/Fri
  for (let w = 0; w < 4; w++) {
    const base = new Date(weekStart + "T00:00:00Z");
    base.setUTCDate(base.getUTCDate() + w * 7);
    const ws = base.toISOString().slice(0, 10);

    for (let i = 0; i < platformList.length; i++) {
      const platform = platformList[i];
      const days = daysPerPlatform[i] ?? [2, 4];
      for (const dayOffset of days) {
        const sched = new Date(base);
        sched.setUTCDate(base.getUTCDate() + dayOffset);
        const scheduledDate = sched.toISOString().slice(0, 10);
        const contentType = CONTENT_TYPES[contentTypeIndex % CONTENT_TYPES.length];
        contentTypeIndex++;

        rows.push({
          business_id: businessId,
          platform,
          week_start_date: ws,
          scheduled_date: scheduledDate,
          content_type: contentType,
          status: "planned",
        });
      }
    }
  }

  const { error: insertErr } = await supabaseAdmin.from("posts").insert(rows);
  if (insertErr) {
    console.error("calendar generate insert", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "content_calendar_generated",
    { business_id: businessId, post_count: rows.length }
  );

  return NextResponse.json({ calendarGenerated: true, postCount: rows.length });
}
