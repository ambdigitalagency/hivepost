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

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

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
      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{t("business.stepLabel").replace("{{current}}", "1").replace("{{total}}", "3")}</span>
        <span className="text-neutral-500">33% {t("business.complete")}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div className="h-full w-1/3 rounded-full bg-[var(--accent-orange)]" />
      </div>
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-orange-light)] text-[var(--accent-orange)]">
            <BriefcaseIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("business.tellUs")}</h1>
            <p className="mt-2 text-sm text-neutral-500">{t("business.tellUsHint")}</p>
          </div>
        </div>
        <div className="mt-6">
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
    </div>
  );
}
