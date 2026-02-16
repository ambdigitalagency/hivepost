"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useI18n } from "@/context/I18nContext";

export function HeaderAuth() {
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return <span className="text-sm text-neutral-400">…</span>;
  }

  if (session?.user) {
    const name = session.user.name ?? session.user.email ?? "";
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-600 transition hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {t("nav.dashboard")}
        </Link>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("nav.loggedInAs")} {name}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-xl border border-card-border px-3 py-1.5 text-sm transition hover:bg-page-bg dark:hover:bg-neutral-800"
        >
          {t("nav.logout")}
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="text-sm font-medium text-foreground transition hover:text-neutral-600 dark:hover:text-neutral-300"
    >
      {t("nav.getStarted")}
    </Link>
  );
}
