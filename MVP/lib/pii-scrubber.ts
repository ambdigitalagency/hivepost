/**
 * PII 脱敏（Architecture 3.3）：存储或送 AI 前对用户输入做基础脱敏。
 * 仅做正则替换，不送 LLM。
 */

/** 脱敏后占位符 */
const PLACEHOLDERS = {
  phone: "[PHONE]",
  email: "[EMAIL]",
  address: "[ADDRESS]",
};

// 美国/北美电话：多种格式
const PHONE_REGEX =
  /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
// 常见邮箱
const EMAIL_REGEX =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// 简单地址：数字 + 街道关键词 + 短片段（避免误伤过长）
const ADDRESS_REGEX =
  /\b\d{1,6}\s+[\w\s]{2,40}(?:street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln|way|court|ct|place|pl)\b/gi;

/**
 * 对文本做 PII 脱敏，返回脱敏后的字符串。
 */
export function redactPii(text: string): string {
  if (typeof text !== "string") return "";
  const out = text
    .replace(PHONE_REGEX, PLACEHOLDERS.phone)
    .replace(EMAIL_REGEX, PLACEHOLDERS.email)
    .replace(ADDRESS_REGEX, PLACEHOLDERS.address);
  return out;
}
