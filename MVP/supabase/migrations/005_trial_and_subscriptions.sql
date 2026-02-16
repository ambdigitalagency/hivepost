-- HivePost: 免费试用一个月 + 订阅（为支付预留）
-- 1. users 增加 trial_ends_at：首次登录或创建业务时设为 NOW() + 30 days，仅当为 NULL 时写入
-- 2. subscriptions 表：为 Stripe 订阅预留，便于后续支付对齐

-- =============================================================================
-- users: trial_ends_at
-- =============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.trial_ends_at IS 'End of free trial (set on first login or first business creation); NULL = legacy user without trial';

-- =============================================================================
-- subscriptions（为 Stripe 预留）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'past_due')),
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  plan_id TEXT,
  posts_per_month INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id_active
  ON public.subscriptions(user_id)
  WHERE status IN ('trial', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE public.subscriptions IS 'Stripe subscriptions; one active per user; trial_ends_at / current_period_end for access checks';
