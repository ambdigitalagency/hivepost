/**
 * 测试 Replicate 图片生成 API 是否可用。
 * 用法：在 MVP 目录执行 node scripts/test-replicate.cjs
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

const token = process.env.REPLICATE_API_TOKEN;
if (!token?.trim()) {
  console.error("Missing REPLICATE_API_TOKEN in .env or .env.local");
  process.exit(1);
}

async function main() {
  const Replicate = (await import("replicate")).default;
  const replicate = new Replicate({ auth: token });
  const testPrompt = "A friendly local plumber's van with contact info, sunny day, professional photo";

  console.log("Testing Replicate API with prompt:", testPrompt);
  console.log("This may take 10-30 seconds...");

  try {
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          prompt: testPrompt,
          num_outputs: 1,
          width: 512,
          height: 512,
        },
      }
    );
    let url = null;
    if (typeof output === "string") url = output;
    else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      url = typeof first === "string" ? first : first?.url;
    } else if (output?.url) url = output.url;

    if (url) {
      console.log("SUCCESS! Image URL:", url);
      console.log("Replicate API is working.");
    } else {
      console.error("FAIL: No image URL in response:", JSON.stringify(output).slice(0, 200));
      process.exit(1);
    }
  } catch (e) {
    console.error("FAIL:", e.message || e);
    process.exit(1);
  }
}

main();
