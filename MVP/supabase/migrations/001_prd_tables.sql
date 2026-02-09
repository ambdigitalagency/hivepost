-- HivePost MVP — PRD §14 表结构 (Supabase/Postgres)
-- 运行方式：在 Supabase Dashboard → SQL Editor 中执行本文件，或使用 Supabase CLI: supabase db push

-- 启用 UUID 扩展（Supabase 默认已启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. users（与 NextAuth 关联：用 auth_provider_id 存 Google sub，登录时 upsert）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_provider_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  first_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'App users; auth_provider_id = NextAuth/Google sub';

-- =============================================================================
-- 2. businesses
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  region TEXT NOT NULL DEFAULT 'US',
  language TEXT NOT NULL,
  tone TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

-- =============================================================================
-- 3. business_platforms（每业务最多 2 个平台，由应用层 + 触发器双重保证）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.business_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_business_platforms_business_id ON public.business_platforms(business_id);

-- 每业务最多 2 个平台
CREATE OR REPLACE FUNCTION check_business_platforms_max_two()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.business_platforms WHERE business_id = NEW.business_id) >= 2 THEN
    RAISE EXCEPTION 'Each business can have at most 2 platforms.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_platforms_max_two ON public.business_platforms;
CREATE TRIGGER trg_business_platforms_max_two
  BEFORE INSERT ON public.business_platforms
  FOR EACH ROW EXECUTE PROCEDURE check_business_platforms_max_two();

-- =============================================================================
-- 4. strategies
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  recommended_platforms JSONB NOT NULL DEFAULT '[]',
  strategy_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategies_business_id ON public.strategies(business_id);

-- =============================================================================
-- 5. ingests（脱敏后的用户粘贴内容）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ingests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  redacted_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingests_business_id ON public.ingests(business_id);

-- =============================================================================
-- 6. posts（日历 = status=planned 的 posts；无独立 content_calendar 表）
-- =============================================================================
CREATE TYPE post_status AS ENUM (
  'planned',
  'draft',
  'images_pending',
  'ready',
  'exported'
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  scheduled_date DATE NOT NULL,
  content_type TEXT,
  caption_text TEXT,
  risk_flags JSONB,
  status post_status NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_business_id ON public.posts(business_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON public.posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);

-- =============================================================================
-- 7. image_batches（候选批次 / 最终化批次）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.image_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('candidate_low', 'final_high')),
  requested_count INT NOT NULL,
  quality TEXT NOT NULL CHECK (quality IN ('low', 'high')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_image_batches_post_id ON public.image_batches(post_id);

-- =============================================================================
-- 8. post_images（单张图：候选或最终；source_candidate_id 用于最终图指向候选）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.post_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.image_batches(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('candidate_low', 'final_high')),
  storage_key TEXT NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  source_candidate_id UUID REFERENCES public.post_images(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON public.post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_post_images_batch_id ON public.post_images(batch_id);

-- =============================================================================
-- 9. weekly_quota_usage（每平台每周已用条数，用于 2 条/平台/周 限制）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_quota_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  posts_used_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, platform_type, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_quota_usage_lookup ON public.weekly_quota_usage(business_id, platform_type, week_start_date);

-- =============================================================================
-- 10. api_cost_ledger（$100/月 预算与降级阶梯依据）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.api_cost_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'session')),
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image')),
  model TEXT,
  units NUMERIC,
  cost_usd_estimated NUMERIC NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_cost_ledger_owner ON public.api_cost_ledger(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_ledger_created_at ON public.api_cost_ledger(created_at);

-- =============================================================================
-- 11. events（埋点：strategy_confirmed, platforms_selected 等）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  props JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_owner ON public.events(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_events_name_created ON public.events(event_name, created_at);

-- =============================================================================
-- 12. feedback（约 2 周后：5 分制 + 好的地方 + 需改进）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  whats_good TEXT,
  what_to_improve TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

-- =============================================================================
-- RLS（Row Level Security）占位：表已创建，后续可按需启用 RLS 与策略
-- =============================================================================
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
-- ... 其余表同理；策略根据 auth.uid() 或 session 与 user_id/business_id 关联
