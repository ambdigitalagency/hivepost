"use client";

import { useState } from "react";
import { CATEGORY_SUGGESTIONS_EN, CATEGORY_SUGGESTIONS_ZH } from "@/lib/categories";

export type BusinessFormLabels = {
  name: string;
  language: string;
  tone: string;
  category: string;
  city: string;
  state: string;
  postalCode: string;
  save: string;
  region?: string;
  nextChoosePlatforms?: string;
  websiteUrl?: string;
  websiteUrlPlaceholder?: string;
  materialsUpload?: string;
  materialsUploadHint?: string;
};

type BusinessFormProps = {
  labels: BusinessFormLabels;
  locale: string;
  initial?: {
    name?: string | null;
    region?: string | null;
    language?: string | null;
    tone?: string | null;
    category?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    website_url?: string | null;
  };
  businessId?: string;
  onSuccess: (id: string) => void;
};

export function BusinessForm({ labels, locale, initial, businessId, onSuccess }: BusinessFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [region] = useState(initial?.region ?? "US");
  const [language, setLanguage] = useState(initial?.language ?? (locale === "zh" ? "zh" : "en"));
  const [tone, setTone] = useState(initial?.tone ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postal_code ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.website_url ?? "");
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        name: name || null,
        region,
        language,
        tone: tone || null,
        category: category || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        website_url: websiteUrl.trim() || null,
      };
      const url = businessId ? `/api/business/${businessId}` : "/api/business";
      const method = businessId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      const id = data.id ?? businessId!;
      if (!businessId && materialFiles.length > 0) {
        for (const file of materialFiles) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/business/${id}/materials`, { method: "POST", body: fd });
        }
      }
      onSuccess(id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-card-border bg-page-bg px-4 py-2.5 text-foreground placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-500";

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.category}</label>
        <input
          type="text"
          list="category-suggestions"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={locale === "zh" ? "如：餐饮、美甲、美发" : "e.g. plumbing, nail_salon, barber"}
          className={inputClass}
        />
        <datalist id="category-suggestions">
          {(locale === "zh" ? CATEGORY_SUGGESTIONS_ZH : CATEGORY_SUGGESTIONS_EN).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.region ?? "Region"}</label>
        <select value={region} className={inputClass} disabled>
          <option value="US">US</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.language}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={inputClass}
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.tone}</label>
        <input
          type="text"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="e.g. friendly, professional"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-500">How formal or casual should your posts sound?</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.name}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Business name (optional)"
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">{labels.city}</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Los Angeles"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{labels.state}</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="e.g. CA"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.postalCode}</label>
        <input
          type="text"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">{labels.websiteUrl ?? "Website URL (optional)"}</label>
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder={labels.websiteUrlPlaceholder ?? "https://yoursite.com"}
          className={inputClass}
        />
      </div>
      {!businessId && (
        <div>
          <label className="block text-sm font-medium text-foreground">{labels.materialsUpload ?? "Upload materials (optional)"}</label>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setMaterialFiles(Array.from(e.target.files ?? []))}
            className="mt-2 block w-full text-sm text-foreground file:mr-4 file:rounded file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium dark:file:bg-neutral-800"
          />
          <p className="mt-1 text-xs text-neutral-500">{labels.materialsUploadHint ?? "Flyers, brochures, or designs. PDF, JPEG, PNG, WebP. Max 10MB each."}</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-btn px-6 py-3 text-base font-medium text-white shadow-card transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
        >
          {loading ? "..." : labels.nextChoosePlatforms ?? labels.save}
        </button>
      </div>
    </form>
  );
}
