/**
 * 对象存储 — 候选图/最终图存 Supabase Storage
 * Bucket 需在 Supabase Dashboard 创建（如 post-images），可选公开或签名 URL 读取。
 */

import { getSupabaseAdmin } from "./supabase-server";

const BUCKET = "post-images";

/**
 * 上传图片到 Storage，返回用于 DB 的 storage_key（path）
 * path 建议格式：posts/{postId}/batches/{batchId}/{imageId}.png
 */
export async function uploadPostImage(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string = "image/png"
): Promise<{ storageKey: string; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    return { storageKey: "", error: error.message };
  }
  return { storageKey: data.path };
}

/**
 * 获取图片可访问 URL（公开 bucket 用 publicUrl，否则需 signed）
 */
export function getPublicUrl(storageKey: string): string {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
  return data.publicUrl;
}
