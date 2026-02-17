/**
 * Stripe Webhook：checkout.session.completed 时写入 subscriptions，用户获得试用/订阅。
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.client_reference_id;
  const subscriptionId = session.subscription as string | null;
  if (!userId || !subscriptionId) {
    return NextResponse.json({ error: "Missing client_reference_id or subscription" }, { status: 400 });
  }
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const raw = sub as unknown as { current_period_end?: number; trial_end?: number; status?: string; id: string; customer: string; items: { data: Array<{ price?: { id?: string } }> } };
  const currentPeriodEnd = raw.current_period_end
    ? new Date(raw.current_period_end * 1000).toISOString()
    : null;
  const trialEnd = raw.trial_end ? new Date(raw.trial_end * 1000).toISOString() : null;
  const status =
    raw.status === "active"
      ? "active"
      : raw.status === "trialing"
        ? "trial"
        : raw.status === "past_due"
          ? "past_due"
          : "cancelled";
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    status,
    trial_ends_at: trialEnd,
    current_period_end: currentPeriodEnd,
    stripe_subscription_id: raw.id,
    stripe_customer_id: typeof raw.customer === "string" ? raw.customer : (raw.customer as { id: string }).id,
    plan_id: raw.items?.data?.[0]?.price?.id ?? null,
    updated_at: now,
  };
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: now })
    .eq("user_id", userId)
    .in("status", ["trial", "active", "past_due"]);
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("subscriptions")
      .update(row)
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert(row);
  }
  return NextResponse.json({ received: true });
}
