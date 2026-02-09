import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getOrCreateUser } from "@/lib/db-user";
import { PLATFORM_LABELS, PLATFORM_DESCRIPTIONS } from "@/lib/platforms";
import { PlatformSelectClient } from "./PlatformSelectClient";

export const dynamic = "force-dynamic";

export default async function PlatformsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await getOrCreateUser(
    session.user
      ? { id: session.user.id!, email: session.user.email ?? undefined, name: session.user.name ?? undefined }
      : null
  );
  if (!user) redirect("/login");

  const { id } = await params;
  const { data: business, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !business) notFound();

  const { data: strategy } = await supabaseAdmin
    .from("strategies")
    .select("recommended_platforms")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!strategy?.recommended_platforms?.length) {
    redirect(`/dashboard/business/${id}/strategy`);
  }

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);
  const isZh = locale === "zh";

  const recommended = Array.from(
    new Set((strategy.recommended_platforms as string[]) ?? [])
  );
  const platformOptions = recommended
    .filter((key) => PLATFORM_LABELS[key])
    .map((value) => ({
      value,
      label: isZh ? PLATFORM_LABELS[value].zh : PLATFORM_LABELS[value].en,
      description: PLATFORM_DESCRIPTIONS[value]
        ? isZh
          ? PLATFORM_DESCRIPTIONS[value].zh
          : PLATFORM_DESCRIPTIONS[value].en
        : "",
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/business/${id}/strategy`}
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("business.backToDashboard")}
      </Link>
      <div className="mt-6">
        <h1 className="text-xl font-semibold text-foreground">{t("business.choosePlatformsTitle")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("business.choosePlatformsSubtitle")}</p>
        <div className="mt-4 rounded-lg border border-info-border bg-info-bg p-4 text-sm text-blue-800 dark:text-blue-200">
          {t("business.whyTwoInfo")}
        </div>
        <PlatformSelectClient
          businessId={id}
          options={platformOptions}
          labels={{
            selectedCount: t("business.selectedCount"),
            continueToCalendar: t("business.continueToCalendar"),
          }}
        />
      </div>
    </div>
  );
}
