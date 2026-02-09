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
import { EditBusinessClient } from "./EditBusinessClient";

export const dynamic = "force-dynamic";

export default async function EditBusinessPage({
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
    .select("id, name, region, language, tone, category, city, state, postal_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !business) notFound();

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("business.backToDashboard")}
      </Link>
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <h1 className="text-xl font-semibold text-foreground">{t("business.edit")}</h1>
      <EditBusinessClient
        businessId={id}
        locale={locale}
        initial={business}
        labels={{
          name: t("business.name"),
          language: t("business.language"),
          tone: t("business.tone"),
          category: t("business.category"),
          city: t("business.city"),
          state: t("business.state"),
          postalCode: t("business.postalCode"),
          save: t("business.save"),
          region: t("business.region"),
          pasteTitle: t("ingest.pasteTitle"),
          selectPlatforms: t("business.selectPlatforms"),
        }}
      />
      </div>
    </div>
  );
}
