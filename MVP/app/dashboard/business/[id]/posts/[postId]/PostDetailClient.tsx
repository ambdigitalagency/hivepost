"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CandidateImage = { id: string; url: string };

type PostDetailClientProps = {
  businessId: string;
  postId: string;
  status: string;
  captionText: string | null;
  candidateImages: CandidateImage[];
  finalImages: CandidateImage[];
  newBatchAllowed: boolean;
  maxFinalCount: number;
  labels: {
    generateCaption: string;
    generating: string;
    caption: string;
    editCaption: string;
    generateImages: string;
    placeholder: string;
    quotaExceeded: string;
    budgetExceeded: string;
    imageServiceUnconfigured: string;
    imageGenerationFailed: string;
    candidateGallery: string;
    selectUpTo9: string;
    selectUpToN: string;
    newBatch: string;
    finalizeLimitExceeded: string;
    finalizeSelected: string;
    finalizing: string;
    finalImagesTitle: string;
    copyCaption: string;
    captionCopied: string;
    downloadImages: string;
    downloadImagesHint: string;
    markAsUsed: string;
    firstUseMessage: string;
  };
};

export function PostDetailClient({
  businessId,
  postId,
  status,
  captionText,
  candidateImages,
  finalImages,
  newBatchAllowed,
  maxFinalCount,
  labels,
}: PostDetailClientProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState(captionText ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [showFirstUseMessage, setShowFirstUseMessage] = useState(false);

  const isPlanned = status === "planned";
  const isDraft = status === "draft";
  const isImagesPending = status === "images_pending";
  const isReady = status === "ready";
  const isExported = status === "exported";
  const hasCaption = caption.trim().length > 0;
  const showCandidateArea = (isDraft || isImagesPending) && hasCaption;
  const hasCandidates = candidateImages.length > 0;
  const hasFinals = finalImages.length > 0;
  const canSelectMore = selectedIds.size < maxFinalCount;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxFinalCount) next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/${businessId}/posts/${postId}/generate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "quota_exceeded" ? labels.quotaExceeded : (data.message ?? data.error ?? "Request failed"));
        return;
      }
      setCaption(data.caption ?? "");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateImages() {
    setGeneratingImages(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/business/${businessId}/posts/${postId}/images/candidates`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = data.message ?? data.error ?? "Request failed";
        if (data.error === "budget_exceeded") msg = labels.budgetExceeded;
        else if (data.error === "image_service_unconfigured") msg = labels.imageServiceUnconfigured;
        else if (data.error === "image_generation_failed") msg = labels.imageGenerationFailed;
        setError(msg);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setGeneratingImages(false);
    }
  }

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback not needed for HTTPS
    }
  }

  async function handleMarkUsed() {
    try {
      const res = await fetch(
        `/api/business/${businessId}/posts/${postId}/mark-used`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Request failed");
        return;
      }
      if (data.firstTimeUse) setShowFirstUseMessage(true);
      router.refresh();
    } catch {
      setError("Network error");
    }
  }

  async function handleFinalize() {
    if (selectedIds.size === 0) return;
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/business/${businessId}/posts/${postId}/images/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedImageIds: Array.from(selectedIds) }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "finalize_limit"
            ? labels.finalizeLimitExceeded
            : data.error === "budget_exceeded"
              ? labels.budgetExceeded
              : (data.message ?? data.error ?? "Request failed")
        );
        return;
      }
      setSelectedIds(new Set());
      if (data.failedCount > 0 && data.message) {
        setError(data.message);
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setFinalizing(false);
    }
  }

  const btnPrimary =
    "rounded-xl bg-primary-btn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover";
  const btnSecondary =
    "rounded-xl border border-card-border bg-card-bg px-4 py-2 text-sm font-medium transition hover:bg-page-bg disabled:opacity-50 dark:hover:bg-neutral-800";

  return (
    <div className="mt-6 space-y-4">
      {isPlanned && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 shadow-card">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className={btnPrimary}
          >
            {generating ? labels.generating : labels.generateCaption}
          </button>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {(isDraft || hasCaption) && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 shadow-card">
          <h2 className="mb-2 text-sm font-medium text-foreground">{labels.caption}</h2>
          {isEditing ? (
            <div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-card-border bg-page-bg p-3 text-foreground placeholder:text-neutral-400 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
                placeholder={labels.placeholder}
              />
              <p className="mt-2 text-xs text-neutral-500">
                {isDraft
                  ? "Phase 5.3: Edit is UI-only; saving will be added in a later step."
                  : "Edit caption (save not yet implemented)."}
              </p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">
              {caption || labels.placeholder}
            </p>
          )}
          {hasCaption && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {isEditing ? "Done" : labels.editCaption}
            </button>
          )}
        </div>
      )}

      {!hasCaption && !isPlanned && (
        <p className="text-sm text-neutral-500">{labels.placeholder}</p>
      )}

      {showCandidateArea && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 shadow-card">
          <h2 className="mb-2 text-sm font-medium text-foreground">{labels.generateImages}</h2>
          {!hasCandidates && (
            <>
              <button
                type="button"
                onClick={handleGenerateImages}
                disabled={generatingImages}
                className={btnPrimary}
              >
                {generatingImages ? labels.generating : labels.generateImages}
              </button>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              {generatingImages && (
                <p className="mt-2 text-sm text-neutral-500">
                  This may take a minute (generating multiple images).
                </p>
              )}
            </>
          )}
          {hasCandidates && (
            <>
              <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                {labels.candidateGallery} · {labels.selectUpToN}
              </p>
              {newBatchAllowed && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleGenerateImages}
                    disabled={generatingImages}
                    className={btnSecondary}
                  >
                    {generatingImages ? labels.generating : labels.newBatch}
                  </button>
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                  {generatingImages && (
                    <p className="mt-2 text-sm text-neutral-500">
                      This may take a minute (generating multiple images).
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {candidateImages.map((img) => {
                  const selected = selectedIds.has(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => toggleSelected(img.id)}
                      className={`relative block overflow-hidden rounded border-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        selected
                          ? "border-blue-600 ring-2 ring-blue-400"
                          : "border-neutral-200 dark:border-neutral-600"
                      } ${!selected && !canSelectMore ? "opacity-60" : ""}`}
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="h-24 w-full object-cover sm:h-32"
                      />
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={selectedIds.size === 0 || finalizing}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {finalizing ? labels.finalizing : labels.finalizeSelected}
                  {selectedIds.size > 0 && ` (${selectedIds.size})`}
                </button>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {(isReady || isExported) && hasFinals && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 shadow-card">
          <h2 className="mb-2 text-sm font-medium text-foreground">{labels.finalImagesTitle}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {finalImages.map((img) => (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded border border-neutral-200 dark:border-neutral-600"
              >
                <img
                  src={img.url}
                  alt=""
                  className="h-24 w-full object-cover sm:h-32"
                />
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-600">
            <button
              type="button"
              onClick={handleCopyCaption}
              className={btnSecondary}
            >
              {copied ? labels.captionCopied : labels.copyCaption}
            </button>
            <span className="text-sm text-neutral-500">
              {labels.downloadImagesHint}
            </span>
            {!isExported && (
              <button
                type="button"
                onClick={handleMarkUsed}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                {labels.markAsUsed}
              </button>
            )}
          </div>
          {showFirstUseMessage && (
            <p className="mt-3 rounded bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
              {labels.firstUseMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
