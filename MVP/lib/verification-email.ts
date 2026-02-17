import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "HivePost <noreply@email.amb.ltd>";

function buildVerificationEmailHtml(verificationLinkOrCode: string, lang: "zh" | "en"): string {
  const isZh = lang === "zh";
  const line1 = isZh ? "请点击下方链接完成邮箱验证：" : "Click the link below to verify your email:";
  const line2 = isZh ? "如非本人操作，请忽略此邮件。" : "If you didn't request this, you can ignore this email.";
  const isLink = verificationLinkOrCode.startsWith("http");
  const linkHtml = isLink
    ? `<a href="${verificationLinkOrCode}" style="color:#0670DB; font-size: 16px; text-decoration: underline;">${isZh ? "点击验证" : "Verify email"}</a>`
    : `<span style="font-size: 24px; font-weight: 600; letter-spacing: 4px; color:#111;">${verificationLinkOrCode}</span>`;
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background:#f5f5f5; padding: 24px; margin: 0;">
  <div style="max-width: 400px; margin: 0 auto; background:#fff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <p style="margin:0 0 16px; font-size: 16px; color:#333; line-height: 1.5;">${line1}</p>
    <p style="margin:0 0 24px;">${linkHtml}</p>
    <p style="margin:0; font-size: 13px; color:#888;">${line2}</p>
  </div>
</div>`.trim();
}

/**
 * Send verification email with inline HTML (no Resend template). Uses RESEND_API_KEY and RESEND_FROM (default noreply@email.amb.ltd).
 * lang: prefer "zh" or "en" for the body copy.
 */
export async function sendVerificationEmail(params: {
  to: string;
  code: string; // verification link URL or one-time code
  lang?: "zh" | "en";
}): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  const lang = params.lang ?? "en";
  const html = buildVerificationEmailHtml(params.code, lang);
  const subject = lang === "zh" ? "邮箱验证" : "Verify your email";
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: params.to,
    subject,
    html,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
