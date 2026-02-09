/**
 * 策略生成（PRD §7.1, §9.3）：业务信息 + 可选 ingest → 短 SWOT + 内容方向 + 推荐平台（>2）。
 * 中文用户推荐列表默认含小红书、微信朋友圈。
 */

import OpenAI from "openai";
import { ALLOWED_PLATFORM_KEYS, ZH_DEFAULT_PLATFORMS } from "./platforms";

const MODEL = "gpt-4o-mini";

export type StrategyInput = {
  businessName?: string | null;
  category?: string | null;
  region: string;
  language: string;
  tone?: string | null;
  ingestText?: string;
  websiteUrl?: string | null;
};

export type StrategyOutput = {
  strategyText: string;
  recommendedPlatforms: string[];
};

const PLATFORM_KEYS_STR = Array.from(ALLOWED_PLATFORM_KEYS).join(", ");

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * 生成策略文案与推荐平台列表。推荐平台 >2；language=zh 时必含小红书、微信朋友圈。
 */
export async function generateStrategy(input: StrategyInput): Promise<StrategyOutput> {
  const client = getOpenAIClient();
  if (!client) {
    return getFallbackStrategy(input);
  }

  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  const mustInclude = lang === "zh" ? ZH_DEFAULT_PLATFORMS : [];
  const category = input.category?.trim() || "general";
  const region = input.region?.trim() || "US";

  const systemPrompt =
    lang === "zh"
      ? `你是本地小生意的营销分析助手。输出纯 JSON：{"strategyText": "字符串", "recommendedPlatforms": ["平台key数组"]}。
- strategyText：中立客观的分析表述。必须以此结构开头：「基于[行业]在[地区]，您所提供服务的优势是……；劣势是……；机会是……；风险是……。内容方向建议：……」。
用第三人称、客观语气，不用「我们建议」「为您准备」等主观用语。简短、白话、无术语。最多 300 字。
- recommendedPlatforms：至少 3 个平台 key。允许: ${PLATFORM_KEYS_STR}。必须包含: ${mustInclude.join(", ")}。
仅输出 JSON，无其他内容。`
      : `You are a marketing analyst for local small businesses. Output valid JSON only: {"strategyText": "string", "recommendedPlatforms": ["platform keys"]}.
- strategyText: Neutral, objective analysis. MUST start with this structure: "Based on [category] in [region], the strengths of the services you provide are...; weaknesses are...; opportunities are...; threats are.... Content direction: ...".
Use third-person, objective tone. No "we suggest", "we've prepared", or similar subjective phrases. Short, plain language, no jargon. Max 300 words.
- recommendedPlatforms: At least 3 platform keys. Allowed: ${PLATFORM_KEYS_STR}.
Output nothing else.`;

  const userContent = [
    `Business: ${input.businessName ?? "Unnamed"}, category: ${category}, region: ${region}, language: ${input.language}, tone: ${input.tone ?? "friendly"}.`,
    input.websiteUrl ? `Website (for context): ${input.websiteUrl}` : "",
    input.ingestText ? `Customer context or pasted notes:\n${input.ingestText.slice(0, 3000)}` : "",
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
      max_tokens: 800,
      temperature: 0.5,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseStrategyJson(raw, mustInclude, lang);
    return ensureRecommendedPlatforms(parsed, mustInclude);
  } catch {
    return getFallbackStrategy(input);
  }
}

function parseStrategyJson(raw: string, mustInclude: string[], lang: "en" | "zh"): StrategyOutput {
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object" && "strategyText" in json && "recommendedPlatforms" in json) {
      const text = String((json as { strategyText: unknown }).strategyText);
      const arr = (json as { recommendedPlatforms: unknown }).recommendedPlatforms;
      const platforms = Array.isArray(arr)
        ? arr.filter((p): p is string => typeof p === "string" && ALLOWED_PLATFORM_KEYS.has(p))
        : [];
      return {
        strategyText: text.slice(0, 4000) || "Strategy summary will appear here.",
        recommendedPlatforms: platforms.length > 0 ? platforms : [...mustInclude, "instagram", "facebook"].slice(0, 4),
      };
    }
  } catch {
    // ignore
  }
  return {
    strategyText:
      lang === "zh"
        ? "基于一般本地服务业，您所提供服务的优势是本地口碑与信任；劣势是时间有限；机会是老客推荐与季节性需求；风险是竞争较多。内容方向建议：预约方式、服务前后对比、实用小贴士。"
        : "Based on local services in your region, the strengths of the services you provide are local trust and word of mouth; weaknesses are limited capacity; opportunities are referrals and seasonal demand; threats are competition. Content direction: how to book, before/after work, practical tips.",
    recommendedPlatforms: [...mustInclude, "instagram", "facebook", "nextdoor"].filter((p) => ALLOWED_PLATFORM_KEYS.has(p)),
  };
}

function ensureRecommendedPlatforms(out: StrategyOutput, mustInclude: string[]): StrategyOutput {
  const set = new Set(out.recommendedPlatforms);
  for (const p of mustInclude) {
    set.add(p);
  }
  let list = Array.from(set).filter((p) => ALLOWED_PLATFORM_KEYS.has(p));
  if (list.length < 3) {
    const extra = ["instagram", "facebook", "nextdoor", "google_business_profile"].filter((p) => !list.includes(p));
    list = [...list, ...extra].slice(0, 4);
  }
  return { ...out, recommendedPlatforms: list };
}

function getFallbackStrategy(input: StrategyInput): StrategyOutput {
  const lang = input.language?.toLowerCase() === "zh" ? "zh" : "en";
  const mustInclude = lang === "zh" ? ZH_DEFAULT_PLATFORMS : [];
  const platforms = [
    ...mustInclude,
    "instagram",
    "facebook",
    "nextdoor",
  ].filter((p) => ALLOWED_PLATFORM_KEYS.has(p));
  const text =
    lang === "zh"
      ? "基于一般本地服务业，您所提供服务的优势是本地口碑与信任；劣势是时间有限；机会是老客推荐与季节性需求；风险是竞争较多。内容方向建议：预约方式、服务前后对比、实用小贴士。"
      : "Based on local services in your region, the strengths of the services you provide are local trust and word of mouth; weaknesses are limited capacity; opportunities are referrals and seasonal demand; threats are competition. Content direction: how to book, before/after work, practical tips.";
  return { strategyText: text, recommendedPlatforms: platforms };
}
