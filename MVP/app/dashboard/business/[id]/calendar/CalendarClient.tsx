"use client";

import { useRouter } from "next/navigation";

type Post = {
  id: string;
  platform: string;
  platformLabel: string;
  week_start_date: string;
  scheduled_date: string;
  content_type: string | null;
  contentTypeLabel: string;
  status: string;
};

type CalendarClientProps = {
  businessId: string;
  posts: Post[];
  labels: {
    planned: string;
    generatePost: string;
    noPosts: string;
    loading: string;
  };
};

export function CalendarClient({ businessId, posts, labels }: CalendarClientProps) {
  const router = useRouter();

  if (posts.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-8 shadow-card">
        <p className="text-center text-neutral-500">{labels.noPosts}</p>
      </div>
    );
  }

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00Z");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="mt-6 space-y-3">
      {posts.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 shadow-card"
        >
          <span className="font-medium text-foreground">{formatDate(p.scheduled_date)}</span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm dark:bg-neutral-800">
            {p.platformLabel}
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {p.contentTypeLabel}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {labels.planned}
          </span>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/business/${businessId}/posts/${p.id}`)}
            className="ml-auto rounded-xl bg-primary-btn px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-btn-hover dark:text-neutral-900 dark:hover:bg-primary-btn-hover"
          >
            {labels.generatePost}
          </button>
        </div>
      ))}
    </div>
  );
}
