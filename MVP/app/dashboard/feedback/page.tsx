import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { FeedbackFormPage } from "./FeedbackFormPage";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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
      <div className="mt-6">
        <FeedbackFormPage />
      </div>
    </div>
  );
}
