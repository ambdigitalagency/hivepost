"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Locale, Messages } from "@/lib/i18n";
import { createT } from "@/lib/i18n";

const LOCALE_COOKIE = "NEXT_LOCALE";

type I18nContextValue = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useMemo(() => createT(messages), [messages]);
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000`;
      router.refresh();
    },
    [router]
  );
  const value = useMemo(
    () => ({ locale, t, setLocale }),
    [locale, t, setLocale]
  );
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
