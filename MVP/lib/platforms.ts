/** 平台描述（中英），用于选择页卡片 */
export const PLATFORM_DESCRIPTIONS: Record<string, { en: string; zh: string }> = {
  instagram: { en: "Visual posts & stories", zh: "图片与故事" },
  facebook: { en: "Community updates & events", zh: "社区动态与活动" },
  nextdoor: { en: "Local neighborhood reach", zh: "本地邻里覆盖" },
  google_business_profile: { en: "Updates & offers", zh: "商家动态与优惠" },
  xiaohongshu: { en: "Lifestyle & discovery", zh: "生活方式与发现" },
  wechat_moments: { en: "Personal network posts", zh: "朋友圈动态" },
};

/** 平台 key 与展示文案（中英），与 PRD 一致 */
export const PLATFORM_LABELS: Record<string, { en: string; zh: string }> = {
  instagram: { en: "Instagram", zh: "Instagram" },
  facebook: { en: "Facebook", zh: "Facebook" },
  nextdoor: { en: "Nextdoor", zh: "Nextdoor" },
  google_business_profile: { en: "Google Business Profile", zh: "Google 商家档案" },
  xiaohongshu: { en: "Xiaohongshu", zh: "小红书" },
  wechat_moments: { en: "WeChat Moments", zh: "微信朋友圈" },
};

export const ALLOWED_PLATFORM_KEYS = new Set<string>(Object.keys(PLATFORM_LABELS));

/** 各平台免费版文案字数上限（String.length / Unicode 字符数） */
export const PLATFORM_MAX_CAPTION_LENGTH: Record<string, number> = {
  instagram: 2200,
  facebook: 1500,
  nextdoor: 1700,
  google_business_profile: 1500,
  xiaohongshu: 1000,
  wechat_moments: 1500,
};

export function getPlatformMaxCaptionLength(platform: string): number {
  return PLATFORM_MAX_CAPTION_LENGTH[platform] ?? 1500;
}

/** 中文用户推荐列表必须包含的平台（PRD） */
export const ZH_DEFAULT_PLATFORMS = ["xiaohongshu", "wechat_moments"];
