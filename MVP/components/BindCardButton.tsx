"use client";

import { useState } from "react";

export function BindCardButton({
  label,
  loadingLabel = "…",
}: {
  label: string;
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-xl bg-primary-btn px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
