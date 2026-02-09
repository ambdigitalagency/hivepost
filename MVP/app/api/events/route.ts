/**
 * 客户端埋点：接收 event_name + props，以当前登录用户写入 events 表。
 * 用于 feedback_invitation_shown、landing_view 等前端触发的场景。
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { recordEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { event_name: string; props?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { event_name, props } = body;
  if (!event_name || typeof event_name !== "string") {
    return NextResponse.json({ error: "event_name required" }, { status: 400 });
  }

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    event_name,
    typeof props === "object" && props !== null ? props : {}
  );
  return NextResponse.json({ ok: true });
}
