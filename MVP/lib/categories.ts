/**
 * Suggested business categories for local small businesses.
 * Used for dropdown in create business form.
 */

export const CATEGORY_SUGGESTIONS_EN: string[] = [
  "plumbing",
  "cleaning",
  "restaurant",
  "cafe",
  "bakery",
  "nail_salon",
  "barber",
  "hair_salon",
  "massage",
  "spa",
  "auto_repair",
  "tutoring",
  "pet_grooming",
  "laundry",
  "florist",
  "gym",
  "fitness",
  "yoga",
  "photography",
  "landscaping",
];

export const CATEGORY_SUGGESTIONS_ZH: string[] = [
  "餐饮",
  "美发",
  "美甲",
  "按摩",
  "水疗",
  "汽修",
  "辅导",
  "宠物美容",
  "洗衣",
  "花店",
  "健身",
  "瑜伽",
  "摄影",
  "园艺",
  "保洁",
  "水管",
];

/** Display category: first letter uppercase, underscore → space (e.g. nail_salon → Nail salon) */
export function formatCategoryDisplay(slug: string): string {
  if (!slug.trim()) return slug;
  return slug
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tone options for dropdown: value and optional zh label */
export const TONE_OPTIONS: { value: string; en: string; zh: string }[] = [
  { value: "professional", en: "Professional", zh: "专业" },
  { value: "friendly", en: "Friendly", zh: "亲切" },
  { value: "casual", en: "Casual", zh: "随意" },
  { value: "warm", en: "Warm & inviting", zh: "温暖亲切" },
  { value: "inspirational", en: "Inspirational", zh: "励志" },
];
