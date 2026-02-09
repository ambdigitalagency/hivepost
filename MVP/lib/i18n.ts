import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

export type Locale = "en" | "zh";

export const locales: Locale[] = ["en", "zh"];
export const defaultLocale: Locale = "en";

export type Messages = typeof en;

const messageMap: Record<Locale, Messages> = { en, zh };

export function getMessages(locale: Locale): Messages {
  return messageMap[locale] ?? messageMap[defaultLocale];
}

/** Get nested value by dot path, e.g. "home.welcome" */
export function getNested(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function createT(messages: Messages) {
  return (key: string): string => getNested(messages as Record<string, unknown>, key);
}
