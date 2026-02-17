import { NextResponse } from "next/server";
import { verifyTokenAndMarkEmailVerified } from "@/lib/email-verification-token";

function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

/** GET ?token=xxx: verify token and set email_verified_at, then redirect to dashboard. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${getBaseUrl()}/login?error=missing_token`);
  }
  const userId = await verifyTokenAndMarkEmailVerified(token);
  if (!userId) {
    return NextResponse.redirect(`${getBaseUrl()}/login?error=invalid_or_expired_token`);
  }
  return NextResponse.redirect(`${getBaseUrl()}/dashboard?verified=1`);
}
