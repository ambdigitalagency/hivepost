"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const SENT_KEY = "landing_view_sent";

/** 首页浏览埋点（仅登录用户、同 tab 一次）。 */
export function LandingViewTracker() {
  const { data: session, status } = useSession();
  const sent = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || sent.current) return;
    try {
      if (typeof window === "undefined" || window.sessionStorage.getItem(SENT_KEY)) return;
      sent.current = true;
      window.sessionStorage.setItem(SENT_KEY, "1");
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_name: "landing_view" }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [status, session?.user?.id]);

  return null;
}
