"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";

export function FeedbackFormPage() {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [whatsGood, setWhatsGood] = useState("");
  const [whatToImprove, setWhatToImprove] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [thankYou, setThankYou] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const submitFeedback = async () => {
    const form = formRef.current;
    if (!form) return;
    const ratingEl = form.elements.namedItem("feedback-rating") as HTMLSelectElement | null;
    const ratingNum = Number(ratingEl?.value) || 0;
    if (ratingNum < 1 || ratingNum > 5) return;
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: ratingNum,
          whats_good: (form.elements.namedItem("feedback-good") as HTMLTextAreaElement)?.value?.trim() || undefined,
          what_to_improve: (form.elements.namedItem("feedback-improve") as HTMLTextAreaElement)?.value?.trim() || undefined,
        }),
      });
      if (res.ok) setThankYou(true);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void submitFeedback();
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border border-card-border bg-card-bg p-6 shadow-card">
      <h1 className="text-lg font-semibold">{t("feedback.invitationTitle")}</h1>
      {thankYou ? (
        <div className="mt-4">
          <p className="text-neutral-600 dark:text-neutral-400">{t("feedback.thankYou")}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
          >
            {t("feedback.close")}
          </Link>
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="feedback-rating" className="block text-sm font-medium">
              {t("feedback.rating")}
            </label>
            <select
              id="feedback-rating"
              name="feedback-rating"
              required
              value={rating || ""}
              onChange={(e) => setRating(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-card-border bg-page-bg px-3 py-2 dark:bg-neutral-800"
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-good" className="block text-sm font-medium">
              {t("feedback.whatsGood")}
            </label>
            <textarea
              id="feedback-good"
              name="feedback-good"
              value={whatsGood}
              onChange={(e) => setWhatsGood(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-lg border border-card-border bg-page-bg px-3 py-2 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label htmlFor="feedback-improve" className="block text-sm font-medium">
              {t("feedback.whatToImprove")}
            </label>
            <textarea
              id="feedback-improve"
              name="feedback-improve"
              value={whatToImprove}
              onChange={(e) => setWhatToImprove(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-lg border border-card-border bg-page-bg px-3 py-2 dark:bg-neutral-800"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submitFeedback()}
              disabled={submitLoading || rating < 1}
              className="rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
            >
              {submitLoading ? t("feedback.submitting") : t("feedback.submit")}
            </button>
            <Link
              href="/dashboard"
              className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium transition hover:bg-page-bg dark:hover:bg-neutral-800"
            >
              {t("feedback.close")}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
