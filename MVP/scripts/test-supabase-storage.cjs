/**
 * 测试 Supabase Storage（post-images bucket）上传与读取。
 * 用法：在 MVP 目录执行 node scripts/test-supabase-storage.cjs
 */

const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const p = path.join(__dirname, "..", file);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  });
}

loadEnv(".env");
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// 1x1 透明 PNG（最小有效 PNG）
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const testPath = `test/verify-${Date.now()}.png`;

  console.log("1. Uploading test file to post-images...");
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from("post-images")
    .upload(testPath, MINI_PNG, { contentType: "image/png", upsert: true });

  if (uploadErr) {
    console.error("FAIL - Upload error:", uploadErr.message);
    process.exit(1);
  }
  console.log("   Upload OK:", uploadData.path);

  console.log("2. Getting public URL...");
  const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(uploadData.path);
  const publicUrl = urlData.publicUrl;
  console.log("   URL:", publicUrl);

  console.log("3. Verifying URL is accessible...");
  const res = await fetch(publicUrl);
  if (!res.ok) {
    console.error("FAIL - Could not fetch image (status:", res.status, "). Is bucket public?");
    process.exit(1);
  }
  const size = (await res.arrayBuffer()).byteLength;
  console.log("   Fetched OK, size:", size, "bytes");

  console.log("4. Cleaning up test file...");
  await supabase.storage.from("post-images").remove([testPath]);

  console.log("SUCCESS! Supabase Storage (post-images) is working.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
