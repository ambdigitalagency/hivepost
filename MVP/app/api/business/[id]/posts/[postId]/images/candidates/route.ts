/**
 * Phase 6.1: 生成候选图。
 * 校验预算 → 创建 image_batches → 调用 Replicate 生成低质量图 → 上传 Storage → 写入 post_images + api_cost_ledger。
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";
import { checkBudgetForCandidates, checkBudgetForNewBatch, recordCost } from "@/lib/budget";
import { uploadPostImage } from "@/lib/storage";
import {
  generateOneCandidateImage,
  estimateCandidateImageCostUsd,
} from "@/lib/image-generator";
import { captionToImagePrompt } from "@/lib/image-prompt-generator";
import { randomUUID } from "crypto";

async function getAppUserId(session: {
  user?: { id?: string; email?: string | null; name?: string | null };
} | null): Promise<string | null> {
  if (!session?.user?.id) return null;
  const u = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  return u?.id ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId, postId } = await params;

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, category, name, city, state, language")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business)
    return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, status, caption_text, image_prompt")
    .eq("id", postId)
    .eq("business_id", businessId)
    .single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "draft" && post.status !== "images_pending") {
    return NextResponse.json(
      { error: "Post must be in draft or have candidates (to request a new batch)" },
      { status: 400 }
    );
  }
  const caption = post.caption_text?.trim() ?? "";
  if (!caption) {
    return NextResponse.json(
      { error: "Post has no caption; generate caption first" },
      { status: 400 }
    );
  }

  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error: "image_service_unconfigured",
        message: "Image generation is not configured. Add REPLICATE_API_TOKEN to environment variables.",
      },
      { status: 503 }
    );
  }

  const { count: existingBatchCount } = await supabaseAdmin
    .from("image_batches")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("stage", "candidate_low");

  const newBatchCheck = await checkBudgetForNewBatch(existingBatchCount ?? 0);
  if (!newBatchCheck.allowed) {
    return NextResponse.json(
      { error: "budget_exceeded", message: newBatchCheck.reason ?? "New batch not allowed (budget)." },
      { status: 429 }
    );
  }

  const budget = await checkBudgetForCandidates();
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "budget_exceeded", message: budget.reason },
      { status: 429 }
    );
  }
  const count = Math.min(budget.candidateCount, 20);

  const batchId = randomUUID();
  const { error: batchErr } = await supabaseAdmin.from("image_batches").insert({
    id: batchId,
    post_id: postId,
    stage: "candidate_low",
    requested_count: count,
    quality: "low",
    status: "running",
  });
  if (batchErr) {
    console.error("image_batches insert", batchErr);
    return NextResponse.json({ error: batchErr.message }, { status: 500 });
  }

  const imagePrompt =
    post.image_prompt?.trim() ||
    (await captionToImagePrompt({
      caption,
      category: business?.category ?? undefined,
      businessName: business?.name ?? undefined,
      city: business?.city ?? undefined,
      state: business?.state ?? undefined,
      language: business?.language ?? undefined,
    }));

  if (!post.image_prompt?.trim()) {
    await supabaseAdmin
      .from("posts")
      .update({ image_prompt: imagePrompt })
      .eq("id", postId)
      .eq("business_id", businessId);
  }

  const costPerImage = estimateCandidateImageCostUsd();
  const created: string[] = [];
  let lastError: string | null = null;
  const REPLICATE_DELAY_MS = 11000;

  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, REPLICATE_DELAY_MS));
    const gen = await generateOneCandidateImage(imagePrompt);
    if (gen.error || !gen.url) {
      lastError = gen.error ?? "No image URL in response";
      console.warn("Candidate image gen failed", lastError);
      continue;
    }
    let buffer: Buffer;
    try {
      const res = await fetch(gen.url);
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } catch {
      continue;
    }
    const imageId = randomUUID();
    const path = `posts/${postId}/batches/${batchId}/${imageId}.png`;
    const { storageKey, error: uploadErr } = await uploadPostImage(path, buffer, "image/png");
    if (uploadErr || !storageKey) {
      console.warn("Upload failed", uploadErr);
      continue;
    }
    const { data: imgRow } = await supabaseAdmin
      .from("post_images")
      .insert({
        post_id: postId,
        batch_id: batchId,
        stage: "candidate_low",
        storage_key: storageKey,
        selected: false,
      })
      .select("id")
      .single();
    if (imgRow) created.push(imgRow.id);
    await recordCost({
      ownerType: "user",
      ownerId: userId,
      provider: "replicate",
      kind: "image",
      model: "sdxl",
      units: 1,
      costUsdEstimated: costPerImage,
    });
  }

  await supabaseAdmin
    .from("image_batches")
    .update({ status: "succeeded", completed_at: new Date().toISOString() })
    .eq("id", batchId);
  await supabaseAdmin
    .from("posts")
    .update({ status: "images_pending" })
    .eq("id", postId)
    .eq("business_id", businessId);

  await recordEvent(
    { ownerType: "user", ownerId: userId },
    "candidate_images_created",
    { business_id: businessId, post_id: postId, batch_id: batchId, count: created.length }
  );

  if (created.length === 0) {
    const isRateLimit = lastError?.includes("429") || lastError?.toLowerCase().includes("throttl");
    const message = isRateLimit
      ? "Replicate rate limit reached (429). Add credit at replicate.com or wait a minute and try again."
      : lastError ?? "No images could be generated. Check REPLICATE_API_TOKEN and Supabase Storage bucket 'post-images'.";
    return NextResponse.json({ error: "image_generation_failed", message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    batchId,
    count: created.length,
    requestedCount: count,
  });
}
