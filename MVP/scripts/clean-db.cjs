/**
 * 清理数据库，用于从头开始完整测试。
 * 用法：在 MVP 目录执行 node scripts/clean-db.cjs
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

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  Cleared ${table}`);
}

async function main() {
  console.log("Cleaning database...");
  const tables = [
    "post_images",
    "image_batches",
    "posts",
    "weekly_quota_usage",
    "strategies",
    "ingests",
    "business_platforms",
    "feedback",
    "api_cost_ledger",
    "events",
    "businesses",
    "users",
  ];
  for (const table of tables) {
    await deleteAll(table);
  }
  console.log("Database cleaned.");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
