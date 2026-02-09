/**
 * 图片生成 — Replicate，照片级效果（RealVisXL）。
 * 候选图：文生图；最终图：基于候选图 img2img 增强。
 */

/** 单次生成返回图片 URL（Replicate 常见返回） */
export type ImageGenResult = { url: string; error?: string };

function extractUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const u = (first as { url?: string | (() => string) }).url;
      return typeof u === "function" ? u() : (u ?? null);
    }
  }
  if (output && typeof output === "object" && "url" in output) {
    const u = (output as { url?: string | (() => string) }).url;
    return typeof u === "function" ? u() : (u ?? null);
  }
  return null;
}

/**
 * 根据文案生成一张候选图（低质量）。返回可访问的图片 URL。
 * 若未配置 REPLICATE_API_TOKEN 或失败则返回 { url: '', error }。
 */
export async function generateOneCandidateImage(prompt: string): Promise<ImageGenResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token?.trim()) {
    return { url: "", error: "REPLICATE_API_TOKEN not configured" };
  }
  try {
    const Replicate = (await import("replicate")).default;
    const replicate = new Replicate({ auth: token });
    const output = await replicate.run("adirik/realvisxl-v4.0", {
      input: {
        prompt: prompt.slice(0, 1000),
        negative_prompt: "blurry, low quality, distorted, cartoon, illustration",
        num_outputs: 1,
        width: 512,
        height: 512,
      },
    });
    const urlStr = extractUrl(output);
    if (urlStr) return { url: urlStr };
    return { url: "", error: "No image URL in response" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url: "", error: msg };
  }
}

/** 估算单张候选图成本（美元），用于写入 api_cost_ledger */
export function estimateCandidateImageCostUsd(): number {
  return 0.002;
}

/**
 * 生成一张高质量最终图：基于选中的候选图做 img2img 增强，保持构图一致。
 * candidateImageUrl: 候选图的公开 URL
 * prompt: 视觉描述 prompt
 */
export async function generateOneFinalImageFromCandidate(
  candidateImageUrl: string,
  prompt: string
): Promise<ImageGenResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token?.trim()) {
    return { url: "", error: "REPLICATE_API_TOKEN not configured" };
  }
  try {
    const Replicate = (await import("replicate")).default;
    const replicate = new Replicate({ auth: token });
    const output = await replicate.run("adirik/realvisxl-v4.0", {
      input: {
        image: candidateImageUrl,
        prompt: prompt.slice(0, 1000),
        negative_prompt: "blurry, low quality, distorted, cartoon, illustration",
        prompt_strength: 0.35,
        num_outputs: 1,
        width: 1024,
        height: 1024,
      },
    });
    const urlStr = extractUrl(output);
    if (urlStr) return { url: urlStr };
    return { url: "", error: "No image URL in response" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url: "", error: msg };
  }
}

/** 估算单张最终图成本（美元） */
export function estimateFinalImageCostUsd(): number {
  return 0.004;
}
