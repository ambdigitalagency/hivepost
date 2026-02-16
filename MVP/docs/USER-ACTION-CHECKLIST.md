# 你需要做的事 — 账户、迁移、部署

开发已完成的改动需要你在本地/云端做几件事，才能正常跑通试用、上线和后续支付。按顺序做即可。

---

## 发布更新到 Vercel（推荐顺序）

要先把**当前更新版**发到 **hivepost.vercel.app** 时，按下面顺序做，避免线上报错：

1. **先更新数据库**：在 Supabase 项目里跑完 **005 迁移**（见下方「一、1」）。若已跑过，可用同一节的验证 SQL 确认。
2. **再推送代码**：在仓库根目录执行 `git add`、`git commit`、`git push origin main`，Vercel 会自动用 GitHub 的 `main` 分支构建并部署。
3. **确认 Vercel 配置**：Vercel 项目 **Root Directory** 为 `MVP`；**Environment Variables** 里 `NEXTAUTH_URL` 为 `https://hivepost.vercel.app`（或你当前生产域名），其余变量与「三、部署到 Vercel 时要配的环境变量」一致。

部署完成后打开 https://hivepost.vercel.app 用 Google 登录，看 Dashboard 是否显示「免费试用剩余 X 天」。

---

## 一、必做（本地与数据库）

### 1. 执行数据库迁移（试用 + 订阅表）

当前代码依赖 **005_trial_and_subscriptions** 迁移：给 `users` 增加 `trial_ends_at`，并新建 `subscriptions` 表。

**操作：**

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 选你的项目 → 左侧 **SQL Editor**。
2. 若当前标签是别的 SQL（例如 `website_url`），可点 **New query** 开新标签，或直接全选编辑器内容（Cmd+A）后删除。
3. 把下面整段 SQL 复制到 SQL Editor，点击 **Run**。
4. 确认无报错（若列/表已存在会提示，可忽略）。

**005 迁移 SQL（整段复制）：**

```sql
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
```

不做这一步的话，登录或 Dashboard 试用展示可能报错（查不到 `trial_ends_at` 或 `subscriptions`）。

**如何确认迁移已完成：** 在 SQL Editor 里运行下面这句，若结果为 `ok` 且 `has_trial_column=1`、`has_subscriptions_table=1`，即表示 005 已执行成功：

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='trial_ends_at') AS has_trial_column,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') AS has_subscriptions_table,
  CASE
    WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='trial_ends_at') = 1
     AND (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') = 1
    THEN 'ok'
    ELSE 'migration not done'
  END AS status;
```

---

### 2. 本地跑通一遍

在终端：

```bash
cd /Users/michael/Desktop/HivePost/MVP
npm install   # 若还没装过
npm run dev
```

浏览器打开 **http://localhost:3001**，用 Google 登录，创建业务 → 生成一条内容 → 导出/标记已使用。确认：

- Dashboard 能看到「免费试用剩余 X 天」或「试用已结束」。
- 单条可最多选 10 张图并「全部下载为 ZIP」。

---

## 二、要开的账户与配置（上线与支付用）

这些可以等你要部署或接支付时再弄；提前开好也行。

| 用途 | 账户/服务 | 你要做的事 |
|------|------------|------------|
| **部署前端 + API** | [Vercel](https://vercel.com) | 注册/登录 → 用 GitHub 授权 → 把仓库连到 Vercel，Root Directory 设为 `MVP`，配环境变量（见下）。 |
| **数据库 + 存储 + Auth** | [Supabase](https://supabase.com) | 你已有项目的话，只需在 SQL Editor 跑完 005 迁移。新项目则：新建项目 → 在 Settings → API 里拿到 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，填到 Vercel 和本地 `.env`。 |
| **Google 登录** | [Google Cloud Console](https://console.cloud.google.com) | 已有 OAuth 客户端：在「已授权的重定向 URI」里加上生产域名，例如 `https://你的项目.vercel.app/api/auth/callback/google`。新项目则：APIs & Services → Credentials → 创建 OAuth 2.0 客户端（Web），配置同意屏和重定向 URI。 |
| **文案/策略/风控 AI** | [OpenAI](https://platform.openai.com) | 注册 → API Keys 里创建 key → 填到 `.env` 的 `OPENAI_API_KEY`。 |
| **图片生成** | [Replicate](https://replicate.com) | 注册 → Account → API tokens 创建 token → 填到 `.env` 的 `REPLICATE_API_TOKEN`。 |
| **支付（后续）** | [Stripe](https://stripe.com) | 注册 Stripe 企业账号 → 完成身份与银行信息 → 在 Dashboard 创建产品与价格（月付等）→ 把 API Key 和 Webhook Secret 配到 Vercel 环境变量。代码里已有试用与订阅表，接 Stripe 时加 Webhook 和「升级」入口即可。 |

---

## 三、部署到 Vercel 时要配的环境变量

在 Vercel 项目 → **Settings** → **Environment Variables** 里添加（生产/预览建议都勾上）：

| 变量名 | 说明 | 从哪里拿 |
|--------|------|----------|
| `NEXTAUTH_URL` | 生产站点的完整 URL | 部署后填 `https://你的项目.vercel.app` |
| `NEXTAUTH_SECRET` | 随机密钥 | 终端执行 `openssl rand -base64 32` 得到 |
| `GOOGLE_CLIENT_ID` | Google OAuth | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | 同上 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | 同上（注意保密，仅服务端用） |
| `OPENAI_API_KEY` | OpenAI API Key | OpenAI 控制台 |
| `REPLICATE_API_TOKEN` | Replicate API Token | Replicate 账户页 |
| `FEEDBACK_INVITATION_DAYS` | （可选）多少天后弹出反馈邀请 | 默认 `14`，测试可设 `0` |

部署时 **Root Directory** 必须设为 **MVP**，否则 Vercel 找不到 Next.js 项目。

更细的步骤见同目录下的 **VERCEL-DEPLOYMENT.md**。

---

## 四、部署后你再检查

1. 打开生产 URL，用 Google 登录，能进 Dashboard。
2. 创建业务、生成一条内容、导出并「标记已使用」→ 应看到「约 2 周后会再请填反馈」。
3. Dashboard 显示「免费试用剩余 X 天」。
4. （可选）把 `FEEDBACK_INVITATION_DAYS=0` 设成 0，刷新后应出现反馈邀请。

---

## 五、小结

- **立刻要做**：在 Supabase 跑一次 **005_trial_and_subscriptions.sql**，本地 `npm run dev` 走一遍流程。
- **要上线时**：开好 Vercel、Supabase、Google OAuth，把环境变量配齐，Root Directory 设为 `MVP`。
- **要接支付时**：开 Stripe 企业账号，在代码里加 Stripe Webhook 和「升级/订阅」入口（表结构已预留）。

有报错可以把错误信息或截图发出来，再对着排查。
