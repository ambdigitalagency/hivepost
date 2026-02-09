/**
 * 一次性：创建 Supabase Storage bucket「post-images」。
 * 用法：在 MVP 目录执行 node scripts/create-bucket.cjs
 * 会读取 .env 和 .env.local（若存在）。
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase.storage.createBucket("post-images", {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });
  if (error) {
    if (error.message && error.message.includes("already exists")) {
      console.log("Bucket 'post-images' already exists.");
      return;
    }
    console.error("Error:", error.message);
    process.exit(1);
  }
  console.log("Bucket 'post-images' created.", data);
}

main();
