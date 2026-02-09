import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { supabaseAdmin } from "@/lib/supabase-server";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

const CONTENT_TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  tip: { en: "Tip", zh: "小贴士" },
  faq: { en: "FAQ", zh: "问答" },
  story: { en: "Story", zh: "故事" },
  offer: { en: "Offer", zh: "优惠" },
};

export default async function CalendarPage({
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

  const { data: posts } = await supabaseAdmin
    .from("posts")
    .select("id, platform, week_start_date, scheduled_date, content_type, status")
    .eq("business_id", id)
    .eq("status", "planned")
    .order("scheduled_date", { ascending: true });

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);
  const isZh = locale === "zh";

  const postsWithLabels = (posts ?? []).map((p) => ({
    ...p,
    platformLabel: PLATFORM_LABELS[p.platform]
      ? isZh
        ? PLATFORM_LABELS[p.platform].zh
        : PLATFORM_LABELS[p.platform].en
      : p.platform,
    contentTypeLabel: CONTENT_TYPE_LABELS[p.content_type ?? "tip"]
      ? isZh
        ? CONTENT_TYPE_LABELS[p.content_type ?? "tip"].zh
        : CONTENT_TYPE_LABELS[p.content_type ?? "tip"].en
      : p.content_type ?? "tip",
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("calendar.backToDashboard")}
      </Link>
      <div className="mt-6">
        <h1 className="text-xl font-semibold text-foreground">{t("calendar.title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("calendar.subtitle")}</p>
        <CalendarClient
          businessId={id}
          posts={postsWithLabels}
          labels={{
            planned: t("calendar.planned"),
            generatePost: t("calendar.generatePost"),
            noPosts: t("calendar.noPosts"),
            loading: t("calendar.loading"),
          }}
        />
      </div>
    </div>
  );
}
