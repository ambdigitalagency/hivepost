"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PasteClientProps = {
  businessId: string;
  labels: {
    pasteTitle: string;
    pasteHint: string;
    privacyNotice: string;
    privacyDetail: string;
    warning: string;
    characters: string;
    submit: string;
    skip: string;
    continueToStrategy: string;
    backToDashboard: string;
    gatekeeperBlock: string;
  };
};

function interpolate(s: string, params: Record<string, string | number>): string {
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out;
}

export function PasteClient({ businessId, labels }: PasteClientProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "GATEKEEPER_BLOCKED") {
          setError(labels.gatekeeperBlock);
        } else {
          setError(data.message || data.error || "Request failed");
        }
        setLoading(false);
        return;
      }
      router.push(`/dashboard/business/${businessId}/strategy`);
      router.refresh();
    } catch {
      setError("Request failed");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push(`/dashboard/business/${businessId}/strategy`);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="rounded-lg border border-warning-border bg-warning-bg p-4">
        <p className="text-sm font-medium text-foreground">{labels.privacyNotice}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {labels.privacyDetail}
        </p>
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste here..."
          rows={8}
          className="w-full rounded-lg border border-card-border bg-page-bg px-4 py-3 text-foreground placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
          disabled={loading}
        />
        <p className="absolute bottom-3 right-3 text-xs text-neutral-400">
          {interpolate(labels.characters, { n: text.length })}
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary-btn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
        >
          {loading ? "..." : labels.submit}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className="rounded-xl border border-card-border bg-card-bg px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-page-bg disabled:opacity-50 dark:hover:bg-neutral-800"
        >
          {labels.skip}
        </button>
      </div>
    </form>
  );
}
