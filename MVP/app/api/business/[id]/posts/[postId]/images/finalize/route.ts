/**
 * Phase 6.2: 最终化选中的候选图（最多 9 张），生成高质量版并写回存储与 DB。
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordEvent } from "@/lib/events";
import { checkBudgetForFinalize, recordCost } from "@/lib/budget";
import { uploadPostImage } from "@/lib/storage";
import {
  generateOneFinalImageFromCandidate,
  estimateFinalImageCostUsd,
} from "@/lib/image-generator";
import { captionToImagePrompt } from "@/lib/image-prompt-generator";
import { getPublicUrl } from "@/lib/storage";
import { randomUUID } from "crypto";

const ABSOLUTE_MAX_FINAL = 9;

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId, postId } = await params;

  const body = await req.json().catch(() => ({}));
  const selectedImageIds: string[] = Array.isArray(body.selectedImageIds)
    ? body.selectedImageIds
    : [];
  if (selectedImageIds.length === 0 || selectedImageIds.length > ABSOLUTE_MAX_FINAL) {
    return NextResponse.json(
      { error: `Select 1–${ABSOLUTE_MAX_FINAL} candidate images to finalize` },
      { status: 400 }
    );
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, category, name, city, state, language")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // 不选 image_prompt 以兼容未跑 003 迁移的 DB
  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, status, caption_text")
    .eq("id", postId)
    .eq("business_id", businessId)
    .single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "images_pending") {
    return NextResponse.json(
      { error: "Post must have candidate images first (images_pending)" },
      { status: 400 }
    );
  }
  const caption = (post.caption_text ?? "").trim();
  if (!caption) {
    return NextResponse.json({ error: "Post has no caption" }, { status: 400 });
  }

  const { data: candidates } = await supabaseAdmin
    .from("post_images")
    .select("id, storage_key")
    .eq("post_id", postId)
    .eq("stage", "candidate_low")
    .in("id", selectedImageIds);
  const validCandidates = (candidates ?? []).filter((r) => selectedImageIds.includes(r.id));
  const validIds = validCandidates.map((r) => r.id);
  if (validIds.length !== selectedImageIds.length) {
    return NextResponse.json({ error: "Invalid or duplicate image selection" }, { status: 400 });
  }

  const budget = await checkBudgetForFinalize(validIds.length);
  if (!budget.allowed) {
    const status = budget.reason?.includes("At most") ? 400 : 429;
    return NextResponse.json(
      { error: status === 400 ? "finalize_limit" : "budget_exceeded", message: budget.reason },
      { status }
    );
  }

  const batchId = randomUUID();
  await supabaseAdmin.from("image_batches").insert({
    id: batchId,
    post_id: postId,
    stage: "final_high",
    requested_count: validIds.length,
    quality: "high",
    status: "running",
  });

  const imagePrompt =
    post.image_prompt?.trim() ||
    (await captionToImagePrompt({
      caption,
      category: business.category ?? undefined,
      businessName: business.name ?? undefined,
      city: business.city ?? undefined,
      state: business.state ?? undefined,
      language: business.language ?? undefined,
    }));

  const costPerImage = estimateFinalImageCostUsd();
  const REPLICATE_DELAY_MS = 11000;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      write({ type: "start", count: validIds.length });

      const finalized: string[] = [];
      const failedCount: number[] = [];

      for (let idx = 0; idx < validIds.length; idx++) {
    if (idx > 0) await new Promise((r) => setTimeout(r, REPLICATE_DELAY_MS));
    const candidateId = validIds[idx];
    const candidate = validCandidates.find((c) => c.id === candidateId);
    const candidateUrl = candidate?.storage_key ? getPublicUrl(candidate.storage_key) : "";
        if (!candidateUrl) {
          console.warn("No candidate URL for", candidateId);
          failedCount.push(idx + 1);
          write({ type: "error", index: idx });
          continue;
        }
    let gen = await generateOneFinalImageFromCandidate(candidateUrl, imagePrompt);
    for (let retry = 0; retry < 2 && (gen.error || !gen.url); retry++) {
      await new Promise((r) => setTimeout(r, 2000));
      gen = await generateOneFinalImageFromCandidate(candidateUrl, imagePrompt);
    }
        if (gen.error || !gen.url) {
          console.warn("Final image gen failed after retries", gen.error);
          failedCount.push(idx + 1);
          write({ type: "error", index: idx });
          continue;
        }
    let buffer: Buffer;
    let fetchOk = false;
    for (let attempt = 0; attempt < 3 && !fetchOk; attempt++) {
      try {
        const res = await fetch(gen.url);
        if (!res.ok) {
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
          else {
            failedCount.push(idx + 1);
            write({ type: "error", index: idx });
            break;
          }
          continue;
        }
        buffer = Buffer.from(await res.arrayBuffer());
        fetchOk = true;
      } catch (e) {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        else {
          console.warn("Fetch final image failed", e);
          failedCount.push(idx + 1);
          write({ type: "error", index: idx });
          break;
        }
      }
    }
        if (!fetchOk) continue;
        const imageId = randomUUID();
    const path = `posts/${postId}/batches/${batchId}/final-${imageId}.png`;
    const { storageKey, error: uploadErr } = await uploadPostImage(path, buffer, "image/png");
        if (uploadErr || !storageKey) {
          console.warn("Final upload failed", uploadErr);
          failedCount.push(idx + 1);
          write({ type: "error", index: idx });
          continue;
        }
        await supabaseAdmin.from("post_images").insert({
      post_id: postId,
      batch_id: batchId,
      stage: "final_high",
      storage_key: storageKey,
      selected: true,
      source_candidate_id: candidateId,
        });
        finalized.push(storageKey);
        const finalUrl = getPublicUrl(storageKey);
        write({ type: "image", index: idx, url: finalUrl });
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
        .update({ status: "ready" })
        .eq("id", postId)
        .eq("business_id", businessId);

      await recordEvent(
        { ownerType: "user", ownerId: userId },
        "finalize_clicked",
        { business_id: businessId, post_id: postId, count: finalized.length, failed: failedCount.length }
      );

      const err =
        failedCount.length > 0
          ? `${failedCount.length} of ${validIds.length} images could not be generated.`
          : undefined;
      write({ type: "done", total: finalized.length, failed: failedCount.length, error: err });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
