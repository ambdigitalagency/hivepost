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
import { StrategyClient } from "./StrategyClient";

export const dynamic = "force-dynamic";

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await getOrCreateUser(
    session.user
      ? {
          id: session.user.id!,
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
        }
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

  const cookieStore = await cookies();
  const locale =
    (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ??
    defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("business.backToDashboard")}
      </Link>
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <h1 className="text-xl font-semibold text-foreground">{t("strategy.title")}</h1>
        <StrategyClient
          businessId={id}
          locale={locale}
          labels={{
            title: t("strategy.title"),
            generate: t("strategy.generate"),
            generating: t("strategy.generating"),
            generatingStrategy: t("strategy.generatingStrategy"),
            recommendedPlatforms: t("strategy.recommendedPlatformsHint"),
            selectPlatforms: t("strategy.selectPlatforms"),
            selectedCount: t("business.selectedCount"),
            contentGenerate: t("strategy.contentGenerate"),
          }}
        />
      </div>
    </div>
  );
}
