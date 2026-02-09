"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { getLocationTipsText } from "@/lib/location-tips";

type StrategyData = {
  id: string;
  strategyText: string;
  recommendedPlatforms: string[];
  createdAt: string;
};

type StrategyClientProps = {
  businessId: string;
  locale: string;
  labels: {
    title: string;
    noEditHint: string;
    confirmAndContinue: string;
    generate: string;
    generating: string;
    recommendedPlatforms: string;
    locationTipsTitle: string;
    locationTips: string;
  };
};

export function StrategyClient({ businessId, locale, labels }: StrategyClientProps) {
  const router = useRouter();
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isZh = locale === "zh";

  useEffect(() => {
    fetch(`/api/business/${businessId}/strategy`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) setStrategy(data);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [businessId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/${businessId}/strategy`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to generate");
        return;
      }
      setStrategy(data);
    } catch {
      setError("Request failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/${businessId}/strategy/confirm`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed");
        return;
      }
      router.push(`/dashboard/business/${businessId}/platforms`);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-neutral-500">{labels.generating}</p>;
  }
  if (error) {
    return <p className="mt-6 text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!strategy) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-xl bg-primary-btn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
        >
          {generating ? labels.generating : labels.generate}
        </button>
      </div>
    );
  }

  const platformLabels = strategy.recommendedPlatforms
    .map((key) => ({
      key,
      label: isZh ? PLATFORM_LABELS[key]?.zh : PLATFORM_LABELS[key]?.en,
    }))
    .filter((p) => p.label);

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-lg border border-card-border bg-page-bg p-4">
        <p className="whitespace-pre-wrap text-sm text-foreground">{strategy.strategyText}</p>
      </div>
      <div>
        <h2 className="text-sm font-medium text-foreground">{labels.recommendedPlatforms}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {platformLabels.map(({ key, label }) => (
            <li
              key={key}
              className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800"
            >
              {label ?? key}
            </li>
          ))}
        </ul>
      </div>
      {(() => {
        const locationTipsText = getLocationTipsText(
          strategy.recommendedPlatforms,
          isZh ? "zh" : "en"
        );
        if (!locationTipsText) return null;
        return (
          <div className="rounded-lg border border-info-border bg-info-bg p-4">
            <h2 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {labels.locationTipsTitle}
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-blue-700 dark:text-blue-300">
              {locationTipsText}
            </p>
          </div>
        );
      })()}
      <div className="rounded-lg border border-warning-border bg-warning-bg p-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">{labels.noEditHint}</p>
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full rounded-xl bg-primary-btn px-6 py-3 text-base font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
      >
        {confirming ? "..." : labels.confirmAndContinue}
      </button>
    </div>
  );
}
