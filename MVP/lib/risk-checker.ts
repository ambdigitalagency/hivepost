/**
 * Risk Checker — PRD §9.5
 * Input: caption text.
 * Output: pass/fail, risk tags, safe rewrite suggestion.
 */

import OpenAI from "openai";

export type RiskCheckerResult = {
  pass: boolean;
  riskTags: string[];
  safeRewrite: string | null;
};

const MODEL = "gpt-4o-mini";

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

const SYSTEM_PROMPT = `You are a compliance/safety checker for local small-business marketing content.
Flag captions that: make unverifiable claims, promise specific results, contain medical/legal advice, or could mislead customers.
PASS: Normal promotional language, tips, FAQs, offers, stories. Short and factual is fine.
FAIL: Guarantees ("100% fix"), medical advice, legal claims, misleading comparisons, exaggerated promises.
Output only valid JSON: {"pass": true|false, "riskTags": ["tag1","tag2"], "safeRewrite": "rewritten caption or null if pass"}.
If pass=true, safeRewrite must be null. If pass=false, provide a safer version that keeps the intent but removes risks.`;

/**
 * Check caption for compliance/safety risks.
 */
export async function checkCaption(caption: string): Promise<RiskCheckerResult> {
  const trimmed = caption?.trim() ?? "";
  if (trimmed.length === 0) {
    return { pass: true, riskTags: [], safeRewrite: null };
  }

  const client = getOpenAIClient();
  if (!client) {
    return { pass: true, riskTags: [], safeRewrite: null };
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Caption to check:\n${trimmed.slice(0, 2000)}` },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseRiskJson(raw);
    if (parsed) return parsed;
  } catch {
    // on error, pass through (don't block user)
  }
  return { pass: true, riskTags: [], safeRewrite: null };
}

function parseRiskJson(raw: string): RiskCheckerResult | null {
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object" && "pass" in json) {
      const o = json as Record<string, unknown>;
      const pass = o.pass === true;
      const riskTags = Array.isArray(o.riskTags)
        ? (o.riskTags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 5)
        : [];
      const safeRewrite =
        pass || o.safeRewrite == null
          ? null
          : typeof o.safeRewrite === "string"
            ? o.safeRewrite.trim().slice(0, 2000)
            : null;
      return { pass, riskTags, safeRewrite };
    }
  } catch {
    // ignore
  }
  return null;
}
