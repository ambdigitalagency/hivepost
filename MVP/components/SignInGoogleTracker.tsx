"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const PENDING_KEY = "pending_sign_in_google";

/** 登录成功后记录 sign_in_google；依赖登录页点击时设置 sessionStorage。 */
export function SignInGoogleTracker() {
  const { data: session, status } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || done.current) return;
    try {
      if (typeof window === "undefined" || !window.sessionStorage.getItem(PENDING_KEY)) return;
      done.current = true;
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_name: "sign_in_google" }),
      }).finally(() => {
        window.sessionStorage.removeItem(PENDING_KEY);
      });
    } catch {
      // ignore
    }
  }, [status, session?.user?.id]);

  return null;
}
