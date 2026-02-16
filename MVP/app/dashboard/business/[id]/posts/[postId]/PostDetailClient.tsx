"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import JSZip from "jszip";

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
    imageGenerationTimeHint: string;
    candidateImagesHint: string;
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
    downloadAll: string;
    selectAll: string;
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
  newBatchAllowed: _newBatchAllowed, // reserved for future "New batch" UI
  maxFinalCount,
  labels,
}: PostDetailClientProps) {
  void _newBatchAllowed;
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
  const [streamingSlots, setStreamingSlots] = useState<(null | { id: string; url: string })[] | null>(null);
  const [streamingEstimatedMinutes, setStreamingEstimatedMinutes] = useState<number | null>(null);
  const [finalizingSlots, setFinalizingSlots] = useState<(null | { url: string })[] | null>(null);
  const [finalizingOrder, setFinalizingOrder] = useState<string[]>([]);
  const candidatesAbortRef = useRef<AbortController | null>(null);
  const hasAutoTriggeredCaption = useRef(false);

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

  // From calendar "生成帖子": auto-generate caption once when opening a planned post with no caption
  useEffect(() => {
    if (
      status !== "planned" ||
      (captionText != null && captionText.trim().length > 0) ||
      hasAutoTriggeredCaption.current
    ) {
      return;
    }
    hasAutoTriggeredCaption.current = true;
    void handleGenerate();
    // Intentionally run only on mount; captionText/status are the initial server values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const ac = new AbortController();
    candidatesAbortRef.current = ac;
    setGeneratingImages(true);
    setError(null);
    setStreamingSlots(null);
    setStreamingEstimatedMinutes(null);
    try {
      const res = await fetch(
        `/api/business/${businessId}/posts/${postId}/images/candidates`,
        { method: "POST", signal: ac.signal }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let msg = data.message ?? data.error ?? "Request failed";
        if (data.error === "budget_exceeded") msg = labels.budgetExceeded;
        else if (data.error === "image_service_unconfigured") msg = labels.imageServiceUnconfigured;
        else if (data.error === "image_generation_failed") msg = labels.imageGenerationFailed;
        setError(msg);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setError("Stream not available");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const ev = JSON.parse(line) as {
            type?: string;
            count?: number;
            estimatedMinutes?: number;
            index?: number;
            id?: string;
            url?: string;
            error?: string;
            total?: number;
          };
          if (ev.type === "start") {
            const n = ev.count ?? 0;
            setStreamingSlots(Array(n).fill(null));
            setStreamingEstimatedMinutes(ev.estimatedMinutes ?? null);
          } else if (ev.type === "image" && typeof ev.index === "number" && ev.id && ev.url) {
            setStreamingSlots((prev) => {
              if (!prev) return prev;
              const next = [...prev];
              next[ev.index!] = { id: ev.id!, url: ev.url! };
              return next;
            });
          } else if (ev.type === "done") {
            if (ev.error) setError(ev.error);
            router.refresh();
          }
        } catch {
          // ignore parse errors
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      }
      if (buffer.trim()) processLine(buffer);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("Network error");
    } finally {
      candidatesAbortRef.current = null;
      setGeneratingImages(false);
      setStreamingSlots(null);
      setStreamingEstimatedMinutes(null);
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

  function handleSelectAll() {
    const allIds: string[] = [];
    candidateImages.forEach((img) => allIds.push(img.id));
    streamingSlots?.forEach((slot) => slot && allIds.push(slot.id));
    const toSelect = allIds.slice(0, maxFinalCount);
    setSelectedIds(new Set(toSelect));
  }

  async function handleDownloadAll() {
    if (finalImages.length === 0) return;
    try {
      const zip = new JSZip();
      await Promise.all(
        finalImages.map(async (img, i) => {
          const res = await fetch(img.url);
          const blob = await res.blob();
          zip.file(`image-${i + 1}.png`, blob);
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hivepost-images-${postId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed");
    }
  }

  async function handleFinalize() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (generatingImages && candidatesAbortRef.current) {
      candidatesAbortRef.current.abort();
      setGeneratingImages(false);
      setStreamingEstimatedMinutes(null);
    }
    setFinalizing(true);
    setError(null);
    setFinalizingSlots(Array(ids.length).fill(null));
    setFinalizingOrder(ids);
    setSelectedIds(new Set());
    try {
      const res = await fetch(
        `/api/business/${businessId}/posts/${postId}/images/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedImageIds: ids }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "finalize_limit"
            ? labels.finalizeLimitExceeded
            : data.error === "budget_exceeded"
              ? labels.budgetExceeded
              : (data.message ?? data.error ?? "Request failed")
        );
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setError("Stream not available");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const ev = JSON.parse(line) as {
            type?: string;
            count?: number;
            index?: number;
            url?: string;
            error?: string;
            total?: number;
          };
          if (ev.type === "start" && ev.count != null) {
            setFinalizingSlots((prev) => {
              const targetLen = ev.count!;
              if (prev && prev.length === targetLen) return prev;
              return Array(targetLen).fill(null);
            });
          } else if (ev.type === "image" && typeof ev.index === "number" && ev.url) {
            setFinalizingSlots((prev) => {
              if (!prev) return prev;
              const next = [...prev];
              next[ev.index!] = { url: ev.url! };
              return next;
            });
          } else if (ev.type === "done") {
            if (ev.error) setError(ev.error);
            router.refresh();
          }
        } catch {
          /* ignore */
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      }
      if (buffer.trim()) processLine(buffer);
    } catch {
      setError("Network error");
    } finally {
      setFinalizing(false);
      setFinalizingSlots(null);
      setFinalizingOrder([]);
      setStreamingSlots(null);
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
          {!hasCandidates && !hasFinals && !streamingSlots && (
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
                <div className="mt-2 space-y-1 text-sm text-neutral-500">
                  <p>
                    {labels.imageGenerationTimeHint.replace(
                      "{{n}}",
                      String(streamingEstimatedMinutes ?? "5–15")
                    )}
                  </p>
                  <p>{labels.candidateImagesHint}</p>
                </div>
              )}
            </>
          )}
          {(hasCandidates || streamingSlots) && (
            <>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {labels.candidateGallery} · {labels.selectUpToN}
                </p>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {labels.selectAll}
                </button>
              </div>
              <p className="mb-3 text-sm text-neutral-500">{labels.candidateImagesHint}</p>
              {streamingSlots && !finalizingSlots && (
                <p className="mb-3 text-sm text-neutral-500">
                  {labels.imageGenerationTimeHint.replace("{{n}}", String(streamingEstimatedMinutes ?? "5–15"))}
                </p>
              )}
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              {finalizingSlots ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {finalizingSlots.map((slot, i) => {
                    const candidateId = finalizingOrder[i];
                    const candidateUrl =
                      candidateImages.find((c) => c.id === candidateId)?.url ??
                      streamingSlots?.find((s) => s?.id === candidateId)?.url;
                    return slot ? (
                      <div
                        key={`final-${i}`}
                        className="relative h-24 overflow-hidden rounded border-2 border-emerald-500 sm:h-32"
                      >
                        <Image
                          src={slot.url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        key={`finalizing-${i}`}
                        className="relative h-24 overflow-hidden rounded border-2 border-dashed border-neutral-300 sm:h-32 dark:border-neutral-600"
                      >
                        {candidateUrl ? (
                          <Image
                            src={candidateUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                            className="object-cover blur-md"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                            <span className="text-xs text-neutral-500">…</span>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="text-sm font-medium text-white drop-shadow">
                            {labels.finalizing}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
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
                          <div className="relative h-24 w-full sm:h-32">
                            <Image
                              src={img.url}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                              className="object-cover"
                            />
                          </div>
                          {selected && (
                            <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {streamingSlots?.map((slot, i) =>
                      slot ? (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => toggleSelected(slot.id)}
                          className={`relative block overflow-hidden rounded border-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selectedIds.has(slot.id)
                              ? "border-blue-600 ring-2 ring-blue-400"
                              : "border-neutral-200 dark:border-neutral-600"
                          } ${!selectedIds.has(slot.id) && !canSelectMore ? "opacity-60" : ""}`}
                        >
                          <div className="relative h-24 w-full sm:h-32">
                            <Image
                              src={slot.url}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                              className="object-cover"
                            />
                          </div>
                          {selectedIds.has(slot.id) && (
                            <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                              ✓
                            </span>
                          )}
                        </button>
                      ) : (
                        <div
                          key={`placeholder-${i}`}
                          className="flex h-24 items-center justify-center rounded border-2 border-dashed border-neutral-300 bg-neutral-100 sm:h-32 dark:border-neutral-600 dark:bg-neutral-800"
                          aria-hidden
                        >
                          <span className="text-xs text-neutral-500">…</span>
                        </div>
                      )
                    )}
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
                  </div>
                </>
              )}
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
                className="relative block overflow-hidden rounded border border-neutral-200 dark:border-neutral-600"
              >
                <div className="relative h-24 w-full sm:h-32">
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover"
                  />
                </div>
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
            <button
              type="button"
              onClick={handleDownloadAll}
              className={btnSecondary}
            >
              {labels.downloadAll}
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
