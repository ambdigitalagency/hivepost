/**
 * Gatekeeper — 意图/范围校验（PRD §6, §9.1）
 * 在策略生成、内容生成入口调用；不通过时统一提示「请修改输入后重试」。
 * 原则：宁误拦不滥用。
 *
 * 调用点（由 API 在以下入口调用）：
 * - POST /ingest 或「粘贴内容」提交时（4.2）
 * - 策略生成前：业务信息 + 可选 ingest 文本（4.3）
 * - 单条内容/文案生成前：若使用用户输入则先过 Gatekeeper（5.3）
 * 拦截时：返回 common.gatekeeperBlock 文案；并 recordEvent(owner, "gatekeeper_blocked", {}).
 */

import OpenAI from "openai";

export type GatekeeperContext = {
  businessCategory?: string;
  language?: string;
};

export type GatekeeperResult = {
  allowed: boolean;
};

const OPENAI_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a strict gatekeeper for a local small-business marketing tool. Your only job is to decide if the user's input is clearly about business, marketing, brand, services, or local SMB context (e.g. plumber, electrician, cleaning, HVAC). 
ALLOW only when the content is clearly related to: running a local business, marketing that business, customer conversations about services, or content ideas for that business.
BLOCK for: homework, code, legal documents, generic creative writing unrelated to the user's business, off-topic requests, or anything that is not clearly business/marketing related.
When in doubt, BLOCK. Prefer false blocks over abuse.
Reply with exactly one word: ALLOW or BLOCK. No other text.`;

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * 对用户输入做意图/范围校验。空输入视为通过（无内容可拦）。
 * 调用方在 block 时应：1) 返回统一文案 2) 记录 gatekeeper_blocked 事件。
 */
export async function checkGatekeeper(
  text: string,
  context?: GatekeeperContext
): Promise<GatekeeperResult> {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length === 0) {
    return { allowed: true };
  }

  const client = getOpenAIClient();
  if (!client) {
    // 未配置 API key 时保守处理：不通过，避免误放
    return { allowed: false };
  }

  const contextHint =
    context?.businessCategory || context?.language
      ? ` (Business context: ${[context.businessCategory, context.language].filter(Boolean).join(", ")})`
      : "";

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Is this input about local business or marketing? Reply only ALLOW or BLOCK.${contextHint}\n\nInput:\n${trimmed.slice(0, 8000)}`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "";
    const allowed = raw === "ALLOW";
    return { allowed };
  } catch {
    // 网络/API 异常时保守拦截
    return { allowed: false };
  }
}
