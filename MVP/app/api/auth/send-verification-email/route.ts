import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";
import { createVerificationToken } from "@/lib/email-verification-token";
import { sendVerificationEmail } from "@/lib/verification-email";

function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

/** POST: send verification email to current user. Requires session. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }
  const user = await getOrCreateUser({
    id: session.user.id,
    email,
    name: session.user.name ?? undefined,
  });
  if (!user) {
    return NextResponse.json({ error: "Failed to ensure user" }, { status: 500 });
  }
  const token = await createVerificationToken(user.id, email);
  if (!token) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
  const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const { success, error } = await sendVerificationEmail({
    to: email,
    code: verifyUrl,
    lang: "zh",
  });
  if (!success) {
    return NextResponse.json({ error: error ?? "Failed to send email" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
