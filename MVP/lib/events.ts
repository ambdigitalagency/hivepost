/**
 * 事件埋点（PRD §11）：写入 events 表。
 * 供 API 在策略确认、选平台、Gatekeeper 拦截等关键步骤调用。
 */

import { supabaseAdmin } from "@/lib/supabase-server";

export type Owner = {
  ownerType: "user" | "session";
  ownerId: string;
};

/**
 * 记录一条事件。失败时静默（不阻塞主流程）。
 */
export async function recordEvent(
  owner: Owner,
  eventName: string,
  props: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabaseAdmin.from("events").insert({
      owner_type: owner.ownerType,
      owner_id: owner.ownerId,
      event_name: eventName,
      props: Object.keys(props).length ? props : {},
    });
  } catch {
    // 埋点不阻塞业务
  }
}
