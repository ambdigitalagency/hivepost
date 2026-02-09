import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LandingViewTracker } from "@/components/LandingViewTracker";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";

export default async function Home() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-page-bg font-[family-name:var(--font-geist-sans)]">
      <LandingViewTracker />
      <AppHeader />
      <main className="flex flex-col items-center justify-center px-6 py-16 text-center sm:px-8 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {t("home.welcome")}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          {t("home.tagline")}
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-xl bg-primary-btn px-6 py-3 text-base font-medium text-white shadow-card transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
        >
          {t("home.cta")}
        </Link>
      </main>
      <footer className="border-t border-card-border bg-card-bg px-6 py-4 text-center text-sm text-neutral-500 sm:px-8">
        HivePost MVP · EN / 中文
      </footer>
    </div>
  );
}
