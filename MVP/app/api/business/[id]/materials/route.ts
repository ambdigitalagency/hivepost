/**
 * Upload business materials (flyers, designs, etc.) to Storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "business-materials";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

async function getAppUserId(session: { user?: { id?: string; email?: string | null; name?: string | null } } | null) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await getAppUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "No form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type (PDF, JPEG, PNG, WebP only)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = getSupabaseAdmin();
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("business materials upload", uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("business_materials")
    .insert({
      business_id: businessId,
      storage_key: uploadData.path,
      file_name: file.name,
      mime_type: file.type,
    })
    .select("id, storage_key, file_name")
    .single();

  if (insertErr) {
    console.error("business_materials insert", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: row.id, storageKey: row.storage_key, fileName: row.file_name });
}
