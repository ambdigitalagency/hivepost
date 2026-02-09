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
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

function debugLog(payload: Record<string, unknown>) {
  try {
    const dir = join(process.cwd(), ".cursor");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "debug.log"), JSON.stringify(payload) + "\n");
  } catch {}
}

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

  const resolvedParams = await params;
  const pathname = (() => {
    try {
      if (_req.url) return new URL(_req.url).pathname.replace(/\/$/, "") || "";
      return _req.nextUrl?.pathname?.replace(/\/$/, "") ?? "";
    } catch {
      return _req.nextUrl?.pathname ?? "";
    }
  })();
  const urlMatch = pathname.match(/\/api\/business\/([^/]+)\/posts\/([^/]+)\/images\/candidates/);
  const bid = (urlMatch?.[1] ?? resolvedParams?.id ?? (resolvedParams as Record<string, string>)?.businessId ?? "").toString().trim();
  const pid = (urlMatch?.[2] ?? resolvedParams?.postId ?? (resolvedParams as Record<string, string>)?.post_id ?? "").toString().trim();

  // #region agent log
  debugLog({ location: "candidates/route.ts:params", message: "params", data: { bid, pid, fromUrl: !!urlMatch, pathname, paramsKeys: resolvedParams ? Object.keys(resolvedParams) : [] }, timestamp: Date.now(), hypothesisId: "H1" });
  // #endregion

  if (!bid || !pid) {
    return NextResponse.json(
      { error: "Post not found", debug: { receivedBusinessId: bid, receivedPostId: pid, pathname, paramsReceived: resolvedParams } },
      { status: 404 }
    );
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, category, name, city, state, language")
    .eq("id", bid)
    .eq("user_id", userId)
    .single();
  if (!business)
    return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // 与 generate 路由一致：.eq("id", pid).eq("business_id", bid).single()；不选 image_prompt 以兼容未跑 003 迁移的 DB
  const { data: post, error: postErr } = await supabaseAdmin
    .from("posts")
    .select("id, business_id, status, caption_text")
    .eq("id", pid)
    .eq("business_id", bid)
    .single();

  let postExistsWithOtherBusiness = false;
  if (!post && pid) {
    const { data: anyPost } = await supabaseAdmin
      .from("posts")
      .select("id, business_id")
      .eq("id", pid)
      .maybeSingle();
    postExistsWithOtherBusiness = !!anyPost;
  }

  // #region agent log
  debugLog({ location: "candidates/route.ts:postQuery", message: "post query result", data: { postFound: !!post, postErrCode: postErr?.code, postExistsWithOtherBusiness }, timestamp: Date.now(), hypothesisId: "H2" });
  // #endregion

  if (!post) {
    return NextResponse.json(
      {
        error: "Post not found",
        debug: {
          businessId: bid,
          postId: pid,
          postExistsWithOtherBusiness,
          pathnameUsed: pathname || null,
        },
      },
      { status: 404 }
    );
  }
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
    .eq("post_id", pid)
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
    post_id: pid,
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
    const { error: updateErr } = await supabaseAdmin
      .from("posts")
      .update({ image_prompt: imagePrompt })
      .eq("id", pid)
      .eq("business_id", bid);
    // 未跑 003 迁移时无 image_prompt 列 (42703/PGRST204)，忽略
    const ignorable = ["42703", "PGRST204"];
    if (updateErr && !ignorable.includes(updateErr.code ?? "")) {
      console.warn("Update image_prompt failed", updateErr);
    }
  }

  const costPerImage = estimateCandidateImageCostUsd();
  const REPLICATE_DELAY_MS = 11000;
  const estimatedMinutes = Math.ceil((count * (30 + 11)) / 60);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      write({ type: "start", count, estimatedMinutes });

      const created: string[] = [];
      let lastError: string | null = null;

      for (let i = 0; i < count; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, REPLICATE_DELAY_MS));
        const gen = await generateOneCandidateImage(imagePrompt);
        if (gen.error || !gen.url) {
          lastError = gen.error ?? "No image URL in response";
          console.warn("Candidate image gen failed", lastError);
          write({ type: "error", index: i, message: lastError });
          continue;
        }
        let buffer: Buffer;
        try {
          const res = await fetch(gen.url);
          if (!res.ok) {
            write({ type: "error", index: i, message: "Fetch image failed" });
            continue;
          }
          const ab = await res.arrayBuffer();
          buffer = Buffer.from(ab);
        } catch {
          write({ type: "error", index: i, message: "Fetch image failed" });
          continue;
        }
        const imageId = randomUUID();
        const path = `posts/${pid}/batches/${batchId}/${imageId}.png`;
        const { storageKey, error: uploadErr } = await uploadPostImage(path, buffer, "image/png");
        if (uploadErr || !storageKey) {
          console.warn("Upload failed", uploadErr);
          write({ type: "error", index: i, message: uploadErr ?? "Upload failed" });
          continue;
        }
        const { data: imgRow } = await supabaseAdmin
          .from("post_images")
          .insert({
            post_id: pid,
            batch_id: batchId,
            stage: "candidate_low",
            storage_key: storageKey,
            selected: false,
          })
          .select("id")
          .single();
        if (imgRow) created.push(imgRow.id);
        if (created.length === 1) {
          await supabaseAdmin
            .from("posts")
            .update({ status: "images_pending" })
            .eq("id", pid)
            .eq("business_id", bid);
        }
        await recordCost({
          ownerType: "user",
          ownerId: userId,
          provider: "replicate",
          kind: "image",
          model: "sdxl",
          units: 1,
          costUsdEstimated: costPerImage,
        });
        const { getPublicUrl } = await import("@/lib/storage");
        const url = getPublicUrl(storageKey);
        write({ type: "image", index: i, id: imgRow?.id ?? imageId, url });
      }

      await supabaseAdmin
        .from("image_batches")
        .update({ status: "succeeded", completed_at: new Date().toISOString() })
        .eq("id", batchId);
      await supabaseAdmin
        .from("posts")
        .update({ status: "images_pending" })
        .eq("id", pid)
        .eq("business_id", bid);

      await recordEvent(
        { ownerType: "user", ownerId: userId },
        "candidate_images_created",
        { business_id: bid, post_id: pid, batch_id: batchId, count: created.length }
      );

      const err =
        created.length === 0
          ? (() => {
              const isRateLimit =
                lastError?.includes("429") || lastError?.toLowerCase().includes("throttl");
              return isRateLimit
                ? "Replicate rate limit reached (429). Add credit at replicate.com or wait a minute and try again."
                : lastError ?? "No images could be generated.";
            })()
          : undefined;
      write({ type: "done", total: created.length, error: err });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
