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
import { PasteClient } from "./PasteClient";

export const dynamic = "force-dynamic";

export default async function PastePage({
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
        <h1 className="text-xl font-semibold text-foreground">{t("ingest.pasteTitle")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("ingest.pasteHint")}</p>
        <PasteClient
          businessId={id}
          labels={{
            pasteTitle: t("ingest.pasteTitle"),
            pasteHint: t("ingest.pasteHint"),
            privacyNotice: t("ingest.privacyNotice"),
            privacyDetail: t("ingest.privacyDetail"),
            warning: t("ingest.warning"),
            characters: t("ingest.characters"),
            submit: t("ingest.submit"),
            skip: t("ingest.skip"),
            continueToStrategy: t("ingest.continueToStrategy"),
            backToDashboard: t("business.backToDashboard"),
            gatekeeperBlock: t("common.gatekeeperBlock"),
          }}
        />
      </div>
    </div>
  );
}
