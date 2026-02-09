"use client";

import { useEffect, useRef } from "react";

/** 访问「创建业务」页时埋点 onboarding_started（一次）。 */
export function OnboardingStartedTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: "onboarding_started" }),
    }).catch(() => {});
  }, []);

  return null;
}
