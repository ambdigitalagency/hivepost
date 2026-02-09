"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string; description?: string };

type PlatformSelectClientProps = {
  businessId: string;
  options: Option[];
  labels: { selectedCount: string; continueToCalendar: string };
};

function interpolate(s: string, params: Record<string, string | number>): string {
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out;
}

const MAX = 2;

export function PlatformSelectClient({ businessId, options, labels }: PlatformSelectClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/business/${businessId}/platforms`)
      .then((r) => r.json())
      .then((data) => {
        if (data.platforms && Array.isArray(data.platforms)) {
          setSelected(data.platforms.map((p: { platform: string }) => p.platform));
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [businessId]);

  function toggle(value: string) {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((p) => p !== value);
      if (prev.length >= MAX) return prev;
      return Array.from(new Set([...prev, value]));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/${businessId}/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      const calRes = await fetch(`/api/business/${businessId}/calendar/generate`, { method: "POST" });
      await calRes.json().catch(() => ({}));
      router.push(`/dashboard/business/${businessId}/calendar`);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-neutral-500">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer gap-4 rounded-xl border border-card-border bg-card-bg p-4 shadow-card transition hover:bg-page-bg ${
              selected.includes(opt.value) ? "ring-2 ring-neutral-400 dark:ring-neutral-500" : ""
            } ${!selected.includes(opt.value) && selected.length >= MAX ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              disabled={!selected.includes(opt.value) && selected.length >= MAX}
              className="mt-1 h-4 w-4 rounded border-neutral-300"
            />
            <div>
              <span className="font-medium text-foreground">{opt.label}</span>
              {opt.description && (
                <p className="mt-0.5 text-sm text-neutral-500">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm text-neutral-500">
          {interpolate(labels.selectedCount, { n: selected.length })}
        </span>
        <button
          type="submit"
          disabled={saving || selected.length === 0}
          className="rounded-xl bg-primary-btn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
        >
          {saving ? "..." : labels.continueToCalendar}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
