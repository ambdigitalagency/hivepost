import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateBusinessClient } from "./CreateBusinessClient";
import { OnboardingStartedTracker } from "@/components/OnboardingStartedTracker";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);

  return (
    <div className="mx-auto max-w-xl">
      <OnboardingStartedTracker />
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("business.backToDashboard")}
      </Link>
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <h1 className="text-xl font-semibold text-foreground">{t("business.tellUs")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("business.tellUsHint")}</p>
        <CreateBusinessClient
          locale={locale}
          labels={{
            create: t("business.create"),
            name: t("business.name"),
            language: t("business.language"),
            tone: t("business.tone"),
            category: t("business.category"),
            city: t("business.city"),
            county: t("business.county"),
            save: t("business.save"),
            nextStepGenerateStrategy: t("business.nextStepGenerateStrategy"),
            scenarioLabel: t("business.scenarioLabel"),
            scenarioPlaceholder: t("business.scenarioPlaceholder"),
            backToDashboard: t("business.backToDashboard"),
            websiteUrl: t("business.websiteUrl"),
            websiteUrlPlaceholder: t("business.websiteUrlPlaceholder"),
            materialsUpload: t("business.materialsUpload"),
            materialsUploadHint: t("business.materialsUploadHint"),
          }}
        />
      </div>
    </div>
  );
}
