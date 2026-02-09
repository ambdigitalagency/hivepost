/**
 * Extractor — PRD §9.2
 * Input: pasted conversations/notes (ingest) + business context.
 * Output: business type, pain points, tone, do-not-say, locale (US).
 * Used by Copywriter as structured signals.
 */

import OpenAI from "openai";

export type ExtractorInput = {
  businessName?: string | null;
  category?: string | null;
  language?: string;
  tone?: string | null;
  ingestText?: string;
};

export type ExtractorOutput = {
  businessType: string;
  painPoints: string[];
  tone: string;
  doNotSay: string[];
  locale: string;
};

const MODEL = "gpt-4o-mini";

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * Extract structured business signals from ingest text and business info.
 * If no ingest, returns minimal signals from business metadata.
 */
export async function extractSignals(input: ExtractorInput): Promise<ExtractorOutput> {
  const client = getOpenAIClient();
  if (!client || !input.ingestText?.trim()) {
    return getFallbackSignals(input);
  }

  const systemPrompt = `You are a marketing assistant for local small businesses. Extract structured signals from the user's pasted content.
Output only valid JSON with: "businessType" (string, e.g. plumber, cleaner), "painPoints" (array of strings, customer concerns), "tone" (string: friendly, professional, casual), "doNotSay" (array of strings, things to avoid), "locale" (string, always "US").
Keep arrays short (max 5 items). Use plain language.`;

  const userContent = [
    `Business: ${input.businessName ?? "Unnamed"}, category: ${input.category ?? "general"}, language: ${input.language ?? "en"}, tone: ${input.tone ?? "friendly"}.`,
    `Pasted content:\n${input.ingestText.slice(0, 4000)}`,
  ].join("\n\n");

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseExtractorJson(raw);
    if (parsed) return parsed;
  } catch {
    // fall through to fallback
  }
  return getFallbackSignals(input);
}

function parseExtractorJson(raw: string): ExtractorOutput | null {
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object" && "businessType" in json) {
      const o = json as Record<string, unknown>;
      return {
        businessType: String(o.businessType ?? "local service"),
        painPoints: Array.isArray(o.painPoints)
          ? (o.painPoints as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 5)
          : [],
        tone: String(o.tone ?? "friendly"),
        doNotSay: Array.isArray(o.doNotSay)
          ? (o.doNotSay as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 5)
          : [],
        locale: String(o.locale ?? "US"),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function getFallbackSignals(input: ExtractorInput): ExtractorOutput {
  return {
    businessType: input.category ?? "local service",
    painPoints: [],
    tone: input.tone ?? "friendly",
    doNotSay: [],
    locale: "US",
  };
}
