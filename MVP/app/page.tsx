import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LandingViewTracker } from "@/components/LandingViewTracker";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
function CheckShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" />
    </svg>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-page-bg font-[family-name:var(--font-geist-sans)]">
      <LandingViewTracker />
      <AppHeader />
      <main className="flex flex-col items-center px-6 py-16 text-center sm:px-8 sm:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-orange)] bg-[var(--accent-orange-light)] px-3.5 py-1.5 text-sm font-medium text-foreground">
          <LightningIcon className="h-4 w-4 text-[var(--accent-orange)]" />
          {t("home.pill")}
        </span>
        <h1 className="mt-6 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-tight">
          {t("home.headline1")}
          <br />
          <span className="text-[var(--accent-orange)]">{t("home.headline2")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          {t("home.tagline")}
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--primary-button)] px-6 py-3 text-base font-medium text-white shadow-card transition hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:opacity-90"
        >
          {t("home.cta")}
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckShieldIcon className="h-5 w-5 text-emerald-600" />
            {t("home.trust1")}
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ClockIcon className="h-5 w-5 text-[var(--accent-orange)]" />
            {t("home.trust2")}
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SparkleIcon className="h-5 w-5 text-violet-500" />
            {t("home.trust3")}
          </span>
        </div>
      </main>
      <footer className="border-t border-card-border bg-card-bg px-6 py-4 text-center text-sm text-neutral-500 sm:px-8">
        HivePost MVP · EN / 中文
      </footer>
    </div>
  );
}
