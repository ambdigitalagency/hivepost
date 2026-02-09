"use client";

import { useI18n } from "@/context/I18nContext";
import type { Locale } from "@/lib/i18n";

const labels: Record<Locale, string> = { en: "EN", zh: "中文" };

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">{labels[locale]}</span>
      {(["en", "zh"] as Locale[]).map((loc) =>
        loc !== locale ? (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            className="text-sm underline hover:no-underline focus:outline-none"
          >
            {labels[loc]}
          </button>
        ) : null
      )}
    </div>
  );
}
