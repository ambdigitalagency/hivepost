"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HeaderAuth } from "@/components/HeaderAuth";
import { useI18n } from "@/context/I18nContext";

type AppHeaderProps = {
  /** When true, show Usage and Settings nav (dashboard style) */
  dashboardNav?: boolean;
  businessId?: string;
};

export function AppHeader({ dashboardNav, businessId }: AppHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex w-full items-center justify-between border-b border-card-border bg-card-bg px-6 py-4 sm:px-8">
      <Link href="/" className="text-lg font-semibold text-foreground">
        HivePost
      </Link>
      <nav className="flex items-center gap-6">
        {dashboardNav && businessId && (
          <>
            <Link
              href={`/dashboard/business/${businessId}/calendar`}
              className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            >
              <BarChartIcon className="h-4 w-4" />
              {t("nav.usage")}
            </Link>
            <Link
              href={`/dashboard/business/${businessId}/edit`}
              className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            >
              <SettingsIcon className="h-4 w-4" />
              {t("nav.settings")}
            </Link>
          </>
        )}
        <LanguageSwitcher />
        <HeaderAuth />
      </nav>
    </header>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
