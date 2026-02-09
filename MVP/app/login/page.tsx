"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/context/I18nContext";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg font-[family-name:var(--font-geist-sans)]">
        <span className="text-neutral-500">…</span>
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page-bg p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <h1 className="text-center text-2xl font-semibold text-foreground">{t("login.title")}</h1>
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.sessionStorage.setItem("pending_sign_in_google", "1");
              signIn("google", { callbackUrl });
            }}
            className="w-full rounded-xl bg-primary-btn px-6 py-3 text-base font-medium text-white shadow-card transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
          >
            {t("login.signInWithGoogle")}
          </button>
          <Link
            href="/"
            className="w-full rounded-xl border border-card-border bg-card-bg px-5 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-page-bg dark:hover:bg-neutral-800"
          >
            {t("login.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
