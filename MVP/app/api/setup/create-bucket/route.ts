/**
 * 一次性：创建 Storage bucket「post-images」。
 * 仅开发环境可调；生产请在 Supabase Dashboard 创建。
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "post-images";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only in development" }, { status: 403 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });
  if (error) {
    if (error.message?.includes("already exists")) {
      return NextResponse.json({ ok: true, message: "Bucket already exists" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}
