"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/context/I18nContext";

function getTestFeedbackFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("test_feedback") === "1";
}

export function FeedbackInvitation() {
  const { t } = useI18n();
  const [showInvitation, setShowInvitation] = useState(getTestFeedbackFromUrl);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(() => !getTestFeedbackFromUrl());
  const [rating, setRating] = useState(0);
  const [whatsGood, setWhatsGood] = useState("");
  const [whatToImprove, setWhatToImprove] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const invitationShownRecorded = useRef(false);

  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.get("test_feedback") === "1") {
      setShowInvitation(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/feedback/status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.showFeedbackInvitation) setShowInvitation(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showInvitation || invitationShownRecorded.current) return;
    invitationShownRecorded.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: "feedback_invitation_shown" }),
    }).catch(() => {});
  }, [showInvitation]);

  const openForm = () => setShowForm(true);
  const closeForm = () => {
    if (thankYou) {
      setShowInvitation(false);
      setShowForm(false);
      setThankYou(false);
    } else {
      setShowForm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
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

  if (loading || !showInvitation) return null;

  return (
    <>
      {!showForm && (
        <div
          className="border-b border-warning-border bg-warning-bg px-4 py-3"
          role="region"
          aria-label="Feedback invitation"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {t("feedback.invitationTitle")}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("feedback.invitationBody")}
              </p>
            </div>
            <button
              type="button"
              onClick={openForm}
              className="shrink-0 rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
            >
              {t("feedback.openForm")}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-6 shadow-xl">
            <h2 id="feedback-title" className="text-lg font-semibold">
              {t("feedback.invitationTitle")}
            </h2>
            {thankYou ? (
              <div className="mt-4">
                <p className="text-neutral-600 dark:text-neutral-400">{t("feedback.thankYou")}</p>
                <button
                  type="button"
                  onClick={closeForm}
                  className="mt-4 rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
                >
                  {t("feedback.close")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="feedback-rating" className="block text-sm font-medium">
                    {t("feedback.rating")}
                  </label>
                  <select
                    id="feedback-rating"
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
                    value={whatToImprove}
                    onChange={(e) => setWhatToImprove(e.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-card-border bg-page-bg px-3 py-2 dark:bg-neutral-800"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitLoading || rating < 1}
                    className="rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover disabled:opacity-50 dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
                  >
                    {submitLoading ? t("feedback.submitting") : t("feedback.submit")}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium transition hover:bg-page-bg dark:hover:bg-neutral-800"
                  >
                    {t("feedback.close")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
