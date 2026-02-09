# Supabase 数据库设置（HivePost MVP）

本文说明如何在 Supabase 中创建项目并执行 PRD §14 表结构迁移。

## 1. 创建 Supabase 项目

1. 打开 [Supabase](https://supabase.com) 并登录。
2. 点击 **New project**，选择组织、填写项目名称与数据库密码，选择区域（建议与 Vercel 部署区接近）。
3. 等待项目创建完成。

## 2. 获取连接信息

在项目 **Settings → API** 中可看到：

- **Project URL**：`https://xxxx.supabase.co`
- **anon (public) key**：前端或服务端只读/受限操作用
- **service_role key**：服务端完全权限（仅用于后端，勿暴露到前端）

在 **Settings → Database** 中可看到：

- **Connection string**（URI）：用于服务端直连 Postgres（可选）。

后续在 MVP 中会用到 **Project URL** 和 **service_role key**（或 anon + RLS）做服务端 API。

## 3. 执行表结构迁移

### 方式 A：在 Supabase 网页执行（推荐）

1. 在 Supabase 项目中打开 **SQL Editor**。
2. 点击 **New query**。
3. 打开本仓库中的  
   `MVP/supabase/migrations/001_prd_tables.sql`  
   复制全部内容粘贴到编辑器中。
4. 点击 **Run** 执行。

若无报错，PRD §14 中的表会全部创建完成。

### 方式 B：使用 Supabase CLI

若已安装 [Supabase CLI](https://supabase.com/docs/guides/cli) 并已 `supabase link` 到本项目：

```bash
cd MVP
supabase db push
```

（需在 `supabase/config.toml` 中配置好 migrations 路径；默认会读取 `supabase/migrations/*.sql`。）

## 4. 创建的表一览

| 表名 | 说明 |
|------|------|
| `users` | 用户；`auth_provider_id` 存 NextAuth/Google 的 sub，登录时 upsert |
| `businesses` | 业务（行业、地区、语言、语气等） |
| `business_platforms` | 每业务最多 2 个平台（有唯一约束 + 触发器） |
| `strategies` | 策略（SWOT + 推荐平台列表 + 文案） |
| `ingests` | 用户粘贴内容（脱敏后） |
| `posts` | 帖子/日历槽位；`status=planned` 表示日历中的计划条 |
| `image_batches` | 图片批次（候选 low / 最终 high） |
| `post_images` | 单张图片；含 `storage_key`、是否选中、最终图对应候选 |
| `weekly_quota_usage` | 每业务每平台每周已用条数（2 条/平台/周） |
| `api_cost_ledger` | API 成本流水（$100/月 预算与降级依据） |
| `events` | 埋点事件 |
| `feedback` | 用户反馈（5 分 + 好的地方 + 需改进） |

无单独的 `content_calendar` 表；日历即 `posts` 中 `status = 'planned'` 的记录。

## 5. 与 NextAuth 的关联

- 当前 MVP 使用 **NextAuth + Google**，未使用 Supabase Auth。
- 应用层在用户登录后，用 Google 返回的 `sub` 写入/更新 `users.auth_provider_id`，并以此关联 `businesses.user_id`。
- 若日后改用 Supabase Auth，可增加 `users.id = auth.uid()` 的 RLS 策略；本迁移中已预留 RLS 注释，可按需启用。

## 6. 下一步

- 阶段 **3.2**：实现「创建/更新业务」API 与前端，以及「选择 2 个平台」并写入 `business_platforms`。
- 在 `.env.local` 中配置 Supabase：  
  `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（或 anon key + RLS），供 API 与 DB 访问使用。
