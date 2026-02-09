/**
 * Convert marketing caption to a visual image prompt for SDXL.
 * Captions are social copy; image prompts need short, visual descriptions.
 */

import OpenAI from "openai";
import type { ExtractorOutput } from "./extractor";

const MODEL = "gpt-4o-mini";

export type ImagePromptInput = {
  caption: string;
  category?: string | null;
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  language?: string;
  extractorSignals?: Partial<ExtractorOutput>;
};

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * Generate a short, visual prompt for image generation (English, ~50-80 words).
 * SDXL works best with concrete visual descriptions, not marketing copy.
 */
export async function captionToImagePrompt(input: ImagePromptInput): Promise<string> {
  const client = getOpenAIClient();
  if (!client) return truncateVisualFallback(input.caption);

  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  const category = input.category?.trim() || "local business";

  const systemPrompt =
    lang === "zh"
      ? `你是图片提示词助手。将营销文案转化为适合 AI 绘图模型的视觉描述（英文输出）。
要求：用英文输出；50-80 词；描述画面：场景、主体、光线、风格；具体、可成像；避免抽象词、营销话术、emoji。
格式：Photorealistic/stylized scene of [主体], [环境], [光线], [氛围]. 例如：Cozy interior of a noodle shop, steaming bowls of beef noodle soup on wooden tables, warm soft lighting, inviting atmosphere.`
      : `You are an image prompt assistant. Convert marketing copy into a visual description suitable for AI image generation (SDXL).
Requirements: Output in English only; 50-80 words; describe the scene: subject, setting, lighting, style; concrete and visual; avoid abstract words, marketing jargon, emojis.
Format: Photorealistic/stylized scene of [subject], [setting], [lighting], [mood]. E.g.: Cozy interior of a plumbing van, professional tools, warm daylight, trustworthy and approachable atmosphere.`;

  const userContent = [
    `Business category: ${category}`,
    input.businessName ? `Business name: ${input.businessName}` : "",
    input.city && input.state ? `Location: ${input.city}, ${input.state}` : "",
    `Marketing caption to convert:\n${input.caption.slice(0, 600)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

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
  return truncateVisualFallback(input.caption);
}

function truncateVisualFallback(caption: string): string {
  const cleaned = caption.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g, "").replace(/\s+/g, " ");
  const words = cleaned.split(/\s+/).slice(0, 20).join(" ");
  return `Professional local business marketing image, ${words || "service, friendly, trustworthy"}`.slice(0, 500);
}
