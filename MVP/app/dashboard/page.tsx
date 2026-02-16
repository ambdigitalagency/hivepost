import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import Link from "next/link";
import { getMyBusinesses } from "@/lib/db-business";
import { getCurrentAppUserId } from "@/lib/db-user";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getQuotaSummary, daysUntilReset } from "@/lib/quota";
import { getTrialStatus } from "@/lib/trial";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { PlusIcon } from "@/components/PlusIcon";
import { DocumentIcon } from "@/components/DocumentIcon";

export const dynamic = "force-dynamic";

function interpolate(s: string, params: Record<string, string | number>): string {
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);
  const isZh = locale === "zh";

  const businesses = await getMyBusinesses();
  const hasBusiness = businesses && businesses.length > 0;
  const first = hasBusiness ? businesses[0]! : null;

  const userId = await getCurrentAppUserId(session);
  const trialStatus = userId ? await getTrialStatus(userId) : null;

  let platformQuotas: { platform: string; platformLabel: string; used: number; limit: number }[] = [];
  let recentDrafts: { id: string; platform: string; platformLabel: string }[] = [];
  const daysLeft = daysUntilReset();

  if (first) {
    const { data: platforms } = await supabaseAdmin
      .from("business_platforms")
      .select("platform")
      .eq("business_id", first.id)
      .order("platform");
    const platformKeys = (platforms ?? []).map((p) => p.platform);
    const quotas = await getQuotaSummary(first.id, platformKeys);
    platformQuotas = quotas.map((q) => ({
      ...q,
      platformLabel: PLATFORM_LABELS[q.platform]?.[isZh ? "zh" : "en"] ?? q.platform,
    }));

    const { data: drafts } = await supabaseAdmin
      .from("posts")
      .select("id, platform")
      .eq("business_id", first.id)
      .in("status", ["draft", "images_pending", "ready"])
      .order("created_at", { ascending: false })
      .limit(5);
    recentDrafts = (drafts ?? []).map((p) => ({
      id: p.id,
      platform: p.platform,
      platformLabel: PLATFORM_LABELS[p.platform]?.[isZh ? "zh" : "en"] ?? p.platform,
    }));
  }

  if (!hasBusiness) {
    return (
      <div className="mx-auto max-w-2xl">
        {trialStatus && (
          <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t("dashboard.trialTitle")}</h2>
            {trialStatus.subscriptionActive ? (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t("dashboard.subscribed")}</p>
            ) : trialStatus.reason === "trial_expired" ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("dashboard.trialEnded")}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t("dashboard.upgradeToContinue")}</p>
              </div>
            ) : trialStatus.daysLeft != null ? (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {interpolate(t("dashboard.trialDaysLeft"), { n: trialStatus.daysLeft })}
              </p>
            ) : null}
          </div>
        )}
        <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">{t("dashboard.quickActions")}</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/dashboard/business/new"
              className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-card-border bg-page-bg p-8 transition hover:border-neutral-400 hover:bg-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            >
              <PlusIcon className="h-12 w-12 text-neutral-500" />
              <span className="font-medium text-foreground">{t("business.create")}</span>
            </Link>
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {t("login.backHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t("dashboard.quickActions")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link
                href={`/dashboard/business/${first!.id}/paste`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-card-border bg-page-bg p-8 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <PlusIcon className="h-10 w-10 text-neutral-600 dark:text-neutral-400" />
                <span className="text-center font-medium text-foreground">
                  {t("dashboard.newContentInput")}
                </span>
              </Link>
              <Link
                href={`/dashboard/business/${first!.id}/calendar`}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-card-border bg-page-bg p-8 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <DocumentIcon className="h-10 w-10 text-neutral-600 dark:text-neutral-400" />
                <span className="text-center font-medium text-foreground">
                  {t("dashboard.generateThisWeeksPosts")}
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t("dashboard.recentDrafts")}</h2>
            {recentDrafts.length === 0 ? (
              <div className="mt-6 flex flex-col items-center py-8 text-center">
                <DocumentIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
                <p className="mt-2 font-medium text-foreground">{t("dashboard.noDraftsYet")}</p>
                <p className="mt-1 text-sm text-neutral-500">{t("dashboard.startByPasting")}</p>
                <Link
                  href={`/dashboard/business/${first!.id}/paste`}
                  className="mt-4 rounded-lg border border-card-border bg-card-bg px-4 py-2 text-sm font-medium text-foreground transition hover:bg-page-bg dark:hover:bg-neutral-800"
                >
                  {t("dashboard.createFirstDraft")}
                </Link>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentDrafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/business/${first!.id}/posts/${d.id}`}
                      className="block rounded-lg border border-card-border p-3 transition hover:bg-page-bg dark:hover:bg-neutral-800"
                    >
                      <span className="font-medium">{d.platformLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {trialStatus && (
            <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground">{t("dashboard.trialTitle")}</h2>
              {trialStatus.subscriptionActive ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {t("dashboard.subscribed")}
                  {trialStatus.daysLeft != null && trialStatus.daysLeft > 0 && (
                    <span className="ml-1">({interpolate(t("dashboard.trialDaysLeft"), { n: trialStatus.daysLeft })})</span>
                  )}
                </p>
              ) : trialStatus.reason === "trial_expired" ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("dashboard.trialEnded")}</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t("dashboard.upgradeToContinue")}</p>
                </div>
              ) : trialStatus.daysLeft != null ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {interpolate(t("dashboard.trialDaysLeft"), { n: trialStatus.daysLeft })}
                </p>
              ) : null}
            </div>
          )}

          <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("dashboard.thisWeeksQuota")}</h2>
              <span className="text-xs text-neutral-500">
                {interpolate(t("dashboard.resetsInDays"), { n: daysLeft })}
              </span>
            </div>
            {platformQuotas.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">{t("calendar.noPosts")}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {platformQuotas.map((q) => (
                  <div key={q.platform}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{q.platformLabel}</span>
                      <span className="text-neutral-500">
                        {interpolate(t("dashboard.left"), { used: q.used, limit: q.limit })}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className="h-full rounded-full bg-neutral-400 dark:bg-neutral-500"
                        style={{ width: `${(q.used / q.limit) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t("dashboard.needHelp")}</h2>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>{t("dashboard.rule1")}</li>
              <li>{t("dashboard.rule2")}</li>
              <li>{t("dashboard.rule3")}</li>
            </ul>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("dashboard.viewFullLimits")} →
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="/"
        className="mt-6 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {t("login.backHome")}
      </Link>
    </div>
  );
}
