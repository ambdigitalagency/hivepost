/**
 * Per-platform LBS (location) tips. Filter by recommended platforms only.
 * Distinguishes: (1) where to set business address, (2) how to add location when posting.
 */

export type PlatformLocationTip = {
  en: string;
  zh: string;
};

/** Platform key -> LBS tip. Only include platforms we support. */
export const LOCATION_TIPS_BY_PLATFORM: Record<string, PlatformLocationTip> = {
  instagram: {
    en: "Set address: Edit Profile → Contact Options → add address (business account). When posting: tap Add location to tag your place (requires address set on connected Facebook Page first).",
    zh: "设置地址：编辑个人资料 → 联系选项 → 添加地址（商家账号）。发帖时：点击「添加位置」可标记地点（需先在绑定的 Facebook 商家页设置地址）。",
  },
  facebook: {
    en: "Set address: Page → About → Contact and basic info → Add your address. When posting: use Check in to tag location.",
    zh: "设置地址：商家主页 → 关于 → 联络方式与基本资料 → 添加地址。发帖时：使用「打卡」添加位置。",
  },
  nextdoor: {
    en: "Your Business Page address determines reach. Edit in Business Page settings. Location is set at page level, not per post.",
    zh: "商家页面的地址决定覆盖范围。请在商家页面设置中编辑。地址在页面级别设置，非每条帖子单独设置。",
  },
  google_business_profile: {
    en: "Edit profile → Location → enter full street address. Location is tied to your listing.",
    zh: "编辑个人资料 → 位置 → 填写完整街道地址。位置与您的商家信息绑定。",
  },
  xiaohongshu: {
    en: "When creating a note: tap Add location to add place. For stores: merchant.xiaohongshu.com → Store Management.",
    zh: "发笔记时：点击「添加位置」即可添加地点。商家门店：merchant.xiaohongshu.com → 门店管理。",
  },
  wechat_moments: {
    en: "When posting: tap 所在位置 (Location) to add. Enable location permission in phone settings first.",
    zh: "发动态时：点击「所在位置」即可添加。需在手机设置中开启定位权限。",
  },
};

export function getLocationTipsForPlatforms(
  platformKeys: string[],
  lang: "en" | "zh"
): string[] {
  const tips: string[] = [];
  for (const key of platformKeys) {
    const tip = LOCATION_TIPS_BY_PLATFORM[key];
    if (tip) tips.push(lang === "zh" ? tip.zh : tip.en);
  }
  return tips;
}

export function getLocationTipsText(platformKeys: string[], lang: "en" | "zh"): string {
  const tips = getLocationTipsForPlatforms(platformKeys, lang);
  if (tips.length === 0) return "";
  return tips.join("\n\n");
}
