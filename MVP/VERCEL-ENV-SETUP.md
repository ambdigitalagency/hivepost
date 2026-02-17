# Vercel 环境变量配置

在 Vercel 项目 **hivepost** 的 **Settings → Environment Variables** 中新增以下变量。

**STRIPE_PRICE_ID 已添加后**：推代码到主分支会触发 Vercel 自动部署，试用、订阅、邮箱验证、一业务一人等逻辑会一起上线；可在生产环境直接测试。

## 必配（Stripe 试用）

| 变量名 | 说明 | 取值来源 |
|--------|------|----------|
| **STRIPE_PRICE_ID** | Stripe 月付价格的 Price ID | 在 Stripe 里创建「产品 + 月付价格」后，复制该价格的 ID（形如 `price_xxxxx`） |

- **不会在 Stripe 上设置？** 按步骤做：**[docs/Stripe-Setup.md](docs/Stripe-Setup.md)**（产品、月付、拿 Price ID、测试卡号、可选 Webhook）。

---

## 需要发验证邮件时再配（Resend）

| 变量名 | 说明 | 取值来源 |
|--------|------|----------|
| **RESEND_API_KEY** | Resend API 密钥 | [Resend](https://resend.com) → API Keys → Create API Key，复制到 Vercel |
| **RESEND_FROM**（可选） | **发件人邮箱**（用户收到的验证邮件显示「来自」谁） | 当前 Resend 域名为 **email.amb.ltd**，可填 `noreply@email.amb.ltd`；不填则默认 `onboarding@resend.dev`（仅测试用） |

- 未配置 `RESEND_API_KEY` 时，发送验证邮件会失败，可暂不配置，等需要邮箱验证功能时再添加。
- **发送验证邮件的邮箱是什么？** 就是上面的 **发件人**：由 `RESEND_FROM` 决定；不配则代码里默认 `noreply@email.amb.ltd`。
- **邮箱验证**：需在 Supabase SQL Editor 执行 `supabase/migrations/005_email_verification.sql`（`users.email_verified_at` + `email_verification_tokens` 表）。

---

## 操作步骤（Vercel）

1. 打开：**https://vercel.com/michael-lis-projects-008e5d15/hivepost/settings/environment-variables**
2. 点击 **Add New**（或 **Add Environment Variable**）。
3. **Key** 填 `STRIPE_PRICE_ID`，**Value** 填从 Stripe 复制的 `price_xxxxx`，环境选 Production（及 Preview 如需要）→ Save。
4. 需要发验证邮件时：再添加 **RESEND_API_KEY**（必填）、**RESEND_FROM**（可选），保存后重新部署使变量生效。
