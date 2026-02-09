import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getMessages, defaultLocale } from "@/lib/i18n";
import { createT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getPublicUrl } from "@/lib/storage";
import { checkBudgetForNewBatch, getFinalizeMaxCount } from "@/lib/budget";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { PostDetailClient } from "./PostDetailClient";

export const dynamic = "force-dynamic";

const CONTENT_TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  tip: { en: "Tip", zh: "小贴士" },
  faq: { en: "FAQ", zh: "问答" },
  story: { en: "Story", zh: "故事" },
  offer: { en: "Offer", zh: "优惠" },
};

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await getOrCreateUser(
    session.user
      ? { id: session.user.id!, email: session.user.email ?? undefined, name: session.user.name ?? undefined }
      : null
  );
  if (!user) redirect("/login");

  const { id: businessId, postId } = await params;

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (!business) notFound();

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, platform, scheduled_date, content_type, status, caption_text")
    .eq("id", postId)
    .eq("business_id", businessId)
    .single();

  if (!post) notFound();

  let candidateImages: { id: string; url: string }[] = [];
  let finalImages: { id: string; url: string }[] = [];
  if (post.status === "images_pending" || post.status === "ready") {
    const { data: cand } = await supabaseAdmin
      .from("post_images")
      .select("id, storage_key")
      .eq("post_id", postId)
      .eq("stage", "candidate_low");
    candidateImages = (cand ?? []).map((img) => ({
      id: img.id,
      url: getPublicUrl(img.storage_key),
    }));
  }
  if (post.status === "ready" || post.status === "exported") {
    const { data: fin } = await supabaseAdmin
      .from("post_images")
      .select("id, storage_key")
      .eq("post_id", postId)
      .eq("stage", "final_high");
    finalImages = (fin ?? []).map((img) => ({
      id: img.id,
      url: getPublicUrl(img.storage_key),
    }));
  }

  let newBatchAllowed = false;
  let maxFinalCount = 9;
  if (post.status === "draft" || post.status === "images_pending") {
    const { count: batchCount } = await supabaseAdmin
      .from("image_batches")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("stage", "candidate_low");
    const newBatch = await checkBudgetForNewBatch(batchCount ?? 0);
    newBatchAllowed = newBatch.allowed;
    maxFinalCount = await getFinalizeMaxCount();
  }

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");
  const t = createT(messages);
  const isZh = locale === "zh";

  const platformLabel = PLATFORM_LABELS[post.platform]
    ? isZh
      ? PLATFORM_LABELS[post.platform].zh
      : PLATFORM_LABELS[post.platform].en
    : post.platform;
  const contentTypeLabel = CONTENT_TYPE_LABELS[post.content_type ?? "tip"]
    ? isZh
      ? CONTENT_TYPE_LABELS[post.content_type ?? "tip"].zh
      : CONTENT_TYPE_LABELS[post.content_type ?? "tip"].en
    : post.content_type ?? "tip";

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00Z");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const isRestricted =
    (post.status === "draft" || post.status === "images_pending") &&
    (maxFinalCount < 9 || !newBatchAllowed);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/dashboard/business/${businessId}/calendar`}
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        ← {t("calendar.backToCalendar")}
      </Link>
      <div className="mt-6">
        {isRestricted && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-900/20">
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-200">
              Restricted
            </span>
            <span className="ml-2 text-amber-800 dark:text-amber-200">
              Budget limits: max {maxFinalCount} final images; new batch {newBatchAllowed ? "available" : "disabled"}.
            </span>
          </div>
        )}
        <h1 className="text-xl font-semibold text-foreground">{t("calendar.generatePost")}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {formatDate(post.scheduled_date)} · {platformLabel} · {contentTypeLabel}
        </p>
      <PostDetailClient
        businessId={businessId}
        postId={postId}
        status={post.status}
        captionText={post.caption_text}
        candidateImages={candidateImages}
        finalImages={finalImages}
        newBatchAllowed={newBatchAllowed}
        maxFinalCount={maxFinalCount}
        labels={{
          generateCaption: t("post.generateCaption"),
          generating: t("post.generating"),
          caption: t("post.caption"),
          editCaption: t("post.editCaption"),
          generateImages: t("post.generateImages"),
          imageGenerationTimeHint: t("post.imageGenerationTimeHint"),
          candidateImagesHint: t("post.candidateImagesHint"),
          placeholder: t("post.placeholder"),
          quotaExceeded: t("post.quotaExceeded"),
          budgetExceeded: t("post.budgetExceeded"),
          imageServiceUnconfigured: t("post.imageServiceUnconfigured"),
          imageGenerationFailed: t("post.imageGenerationFailed"),
          candidateGallery: t("post.candidateGallery"),
          selectUpTo9: t("post.selectUpTo9"),
          selectUpToN: t("post.selectUpToN").replace("{{n}}", String(maxFinalCount)),
          newBatch: t("post.newBatch"),
          finalizeLimitExceeded: t("post.finalizeLimitExceeded").replace("{{n}}", String(maxFinalCount)),
          finalizeSelected: t("post.finalizeSelected"),
          finalizing: t("post.finalizing"),
          finalImagesTitle: t("post.finalImagesTitle"),
          copyCaption: t("post.copyCaption"),
          captionCopied: t("post.captionCopied"),
          downloadImages: t("post.downloadImages"),
          downloadImagesHint: t("post.downloadImagesHint"),
          markAsUsed: t("post.markAsUsed"),
          firstUseMessage: t("post.firstUseMessage"),
        }}
      />
      </div>
    </div>
  );
}
