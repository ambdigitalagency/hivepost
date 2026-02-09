/**
 * Copywriter — PRD §9.4
 * Input: extractor signals + strategy + platform + content_type + tone + location.
 * Output: platform-tailored caption. Strictly enforces platform character limits.
 */

import OpenAI from "openai";
import type { ExtractorOutput } from "./extractor";
import { PLATFORM_LABELS, getPlatformMaxCaptionLength } from "./platforms";

export type CopywriterInput = {
  extractorSignals: ExtractorOutput;
  strategyText: string;
  platform: string;
  contentType: string;
  tone?: string | null;
  language?: string;
  businessName?: string | null;
  /** Service area for LBS: city, state (e.g. Los Angeles, CA) */
  city?: string | null;
  state?: string | null;
};

const MODEL = "gpt-4o-mini";
const CONTENT_TYPES: Record<string, { en: string; zh: string }> = {
  tip: { en: "Tip", zh: "小贴士" },
  faq: { en: "FAQ", zh: "问答" },
  story: { en: "Story", zh: "故事" },
  offer: { en: "Offer", zh: "优惠" },
};

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

function getHashtagInstruction(platform: string, lang: "en" | "zh"): string {
  const p = platform.toLowerCase();
  if (p === "xiaohongshu") {
    return lang === "zh"
      ? "文末添加 3–5 个相关话题标签，格式如 #本地美食# #探店# ，提升曝光。"
      : "End with 3–5 relevant hashtags in Xiaohongshu format: #话题# (e.g. #LocalFood# #探店#) for discoverability.";
  }
  if (p === "wechat_moments") {
    return lang === "zh"
      ? "微信朋友圈：不要使用话题标签（hashtag）。"
      : "WeChat Moments: do not use any hashtags.";
  }
  if (["instagram", "facebook", "nextdoor", "google_business_profile"].includes(p)) {
    return lang === "zh"
      ? "文末添加 3–5 个相关英文 #hashtag（如 #LocalService #Plumbing），提升曝光。"
      : "End with 3–5 relevant #hashtags (e.g. #LocalService #Plumbing) for discoverability.";
  }
  return "";
}

/**
 * Generate a platform-tailored caption for a single post.
 * Enforces platform character limit; includes location (city, state) when provided.
 */
export async function generateCaption(input: CopywriterInput): Promise<string> {
  const client = getOpenAIClient();
  const maxLen = getPlatformMaxCaptionLength(input.platform);

  if (!client) {
    return truncateToLimit(getFallbackCaption(input), maxLen);
  }

  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  const platformLabel = PLATFORM_LABELS[input.platform]?.[lang] ?? input.platform;
  const typeLabel = CONTENT_TYPES[input.contentType]?.[lang] ?? input.contentType;

  const locationStr =
    input.city && input.state
      ? lang === "zh"
        ? `服务区域：${input.city}, ${input.state}。文案中需自然融入或提及服务地区（如「${input.city}及周边」），便于附近客户找到。`
        : `Service area: ${input.city}, ${input.state}. Include or naturally mention the service area in the caption (e.g. "Serving ${input.city} and nearby") so local customers can find you.`
      : "";

  const hashtagInstruction = getHashtagInstruction(input.platform, lang);
  const systemPrompt = lang === "zh"
    ? `你是本地小生意的营销文案助手。根据业务信息、策略和内容类型，写一段适合${platformLabel}的${typeLabel}帖子文案。
要求：短、口语化、无术语；贴近用户语气；避免夸张承诺；可带 1-2 个相关 emoji。
${hashtagInstruction}
**严格限制：总字数（含标点、emoji、话题标签）不得超过 ${maxLen} 个字符。**
${locationStr}
只输出文案本身，不要标题或额外说明。`
    : `You are a marketing copywriter for local small businesses. Write a short ${typeLabel} caption for ${platformLabel} based on the business info, strategy, and content type.
Requirements: Short, plain language, no jargon; match the user's tone; avoid exaggerated claims; 1-2 relevant emojis OK.
${hashtagInstruction}
**STRICT: Total character count (including punctuation, emojis, hashtags) MUST NOT exceed ${maxLen} characters.**
${locationStr}
Output only the caption, no title or explanation.`;

  const doNotSayStr = input.extractorSignals.doNotSay?.length
    ? `Avoid: ${input.extractorSignals.doNotSay.join("; ")}`
    : "";
  const painStr = input.extractorSignals.painPoints?.length
    ? `Customer concerns to address: ${input.extractorSignals.painPoints.join("; ")}`
    : "";

  const userContent = [
    `Business: ${input.businessName ?? "Local business"}`,
    `Strategy: ${input.strategyText.slice(0, 1000)}`,
    `Platform: ${platformLabel}, Type: ${typeLabel}`,
    `Tone: ${input.tone ?? input.extractorSignals.tone ?? "friendly"}`,
    doNotSayStr,
    painStr,
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
      max_tokens: 400,
      temperature: 0.6,
    });

    const caption = completion.choices?.[0]?.message?.content?.trim();
    if (caption && caption.length > 0) {
      return truncateToLimit(caption, maxLen);
    }
  } catch {
    // fall through
  }
  return truncateToLimit(getFallbackCaption(input), maxLen);
}

function truncateToLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function getFallbackCaption(input: CopywriterInput): string {
  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  if (lang === "zh") {
    return "欢迎联系！专业服务，用心做事。📞 预约方便，回复及时。";
  }
  return "Ready to help! Professional service, easy to book. 📞 Reply fast, schedule anytime.";
}
