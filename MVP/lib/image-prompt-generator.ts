/**
 * Convert marketing caption to a visual image prompt for SDXL.
 * Captions are social copy; image prompts need short, visual descriptions.
 * Finalize purpose: 实景画风 (photorealistic) + 安全约束 (no 18+ for massage/spa/nail).
 */

import OpenAI from "openai";
import type { ExtractorOutput } from "./extractor";

const MODEL = "gpt-4o-mini";

/** Categories that require strict family-safe / no suggestive content in ad images */
const SENSITIVE_CATEGORIES = new Set([
  "massage",
  "spa",
  "nail_salon",
  "nail",
  "barber",
  "hair_salon",
  "美甲",
  "按摩",
  "水疗",
  "美发",
]);

export type ImagePromptInput = {
  caption: string;
  category?: string | null;
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  language?: string;
  extractorSignals?: Partial<ExtractorOutput>;
  /** When "finalize", prompt enforces photorealistic style and safety for sensitive categories */
  purpose?: "candidate" | "finalize";
  /** When true, encourage style consistent with user-uploaded reference photos (e.g. restaurant/spa) */
  hasReferenceMaterials?: boolean;
};

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

function isSensitiveCategory(category: string): boolean {
  const c = category.toLowerCase().trim();
  if (!c) return false;
  if (SENSITIVE_CATEGORIES.has(c)) return true;
  if (c.includes("massage") || c.includes("spa") || c.includes("nail") || c.includes("按摩") || c.includes("水疗") || c.includes("美甲")) return true;
  return false;
}

/**
 * Generate a short, visual prompt for image generation (English, ~50-80 words).
 * SDXL works best with concrete visual descriptions, not marketing copy.
 * When purpose is "finalize": enforces 实景画风 (photorealistic) and safety for massage/spa/nail.
 */
export async function captionToImagePrompt(input: ImagePromptInput): Promise<string> {
  const client = getOpenAIClient();
  if (!client) return truncateVisualFallback(input.caption, input.purpose, input.category ?? undefined);

  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  const category = input.category?.trim() || "local business";
  const forFinalize = input.purpose === "finalize";
  const sensitive = forFinalize && isSensitiveCategory(category);
  const refHint = forFinalize && input.hasReferenceMaterials;

  let systemPrompt: string;
  if (lang === "zh") {
    systemPrompt = `你是图片提示词助手。将营销文案转化为适合 AI 绘图模型的视觉描述（英文输出）。
要求：用英文输出；50-80 词；描述画面：场景、主体、光线、风格；具体、可成像；避免抽象词、营销话术、emoji。
格式：Photorealistic/stylized scene of [主体], [环境], [光线], [氛围]. 例如：Cozy interior of a noodle shop, steaming bowls of beef noodle soup on wooden tables, warm soft lighting, inviting atmosphere.`;
    if (forFinalize) {
      systemPrompt += `
【最终图专用】必须实景画风：真人、真物、真场景，完全写实，像真实拍摄的店面/室内外照片。若有餐厅、spa 等参考图风格，描述应贴近“基于真实场所的二次创作”的写实感。`;
      if (sensitive) {
        systemPrompt += `
【安全约束】该类目（按摩/水疗/美甲等）广告图严禁任何 18 禁或暗示性内容：不得出现暗示性姿势、暴露着装、亲密场景；只允许专业环境（整洁室内、设备、员工着职业装）、放松氛围、适合公开展示的专业广告画面。`;
      }
    }
  } else {
    systemPrompt = `You are an image prompt assistant. Convert marketing copy into a visual description suitable for AI image generation (SDXL).
Requirements: Output in English only; 50-80 words; describe the scene: subject, setting, lighting, style; concrete and visual; avoid abstract words, marketing jargon, emojis.
Format: Photorealistic/stylized scene of [subject], [setting], [lighting], [mood]. E.g.: Cozy interior of a plumbing van, professional tools, warm daylight, trustworthy and approachable atmosphere.`;
    if (forFinalize) {
      systemPrompt += `
[Finalize only] Style must be fully photorealistic: real people, real objects, real settings—like real venue photography. If the business has reference photos (e.g. restaurant or spa), the description should evoke a realistic "secondary creation" based on such real-world imagery.`;
      if (sensitive) {
        systemPrompt += `
[Safety] For this category (massage/spa/nail salon etc.) ad images must be strictly family-safe and professional: no suggestive poses, no revealing clothing, no intimate scenarios; only professional environment (clean interior, equipment, staff in professional attire), relaxation atmosphere suitable for public advertising.`;
      }
    }
  }

  const userParts = [
    `Business category: ${category}`,
    input.businessName ? `Business name: ${input.businessName}` : "",
    input.city && input.state ? `Location: ${input.city}, ${input.state}` : "",
    forFinalize ? "Purpose: finalize (photorealistic, ad-ready image)." : "",
    refHint ? "The business has uploaded reference photos; describe in a way that matches real venue photography style." : "",
    `Marketing caption to convert:\n${input.caption.slice(0, 600)}`,
  ];
  const userContent = userParts.filter(Boolean).join("\n\n");

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 200,
      temperature: 0.4,
    });
    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (raw && raw.length > 20) {
      return raw.slice(0, 500).replace(/\n/g, " ");
    }
  } catch {
    // fall through
  }
  return truncateVisualFallback(input.caption, input.purpose, input.category ?? undefined);
}

function truncateVisualFallback(
  caption: string,
  purpose?: "candidate" | "finalize",
  category?: string
): string {
  const cleaned = caption.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g, "").replace(/\s+/g, " ");
  const words = cleaned.split(/\s+/).slice(0, 20).join(" ");
  let base = `Professional local business marketing image, ${words || "service, friendly, trustworthy"}`;
  if (purpose === "finalize") {
    base = `Photorealistic scene, real people and real setting, ${words || "professional, inviting"}`;
    if (category && isSensitiveCategory(category)) {
      base += ", family-safe, professional attire, clean interior, suitable for public advertising";
    }
  }
  return base.slice(0, 500);
}
