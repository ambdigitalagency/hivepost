# HivePost 部署到 Vercel 指南

## 当前状态

- 项目根目录：`/Users/michael/Desktop/HivePost`（Git、Brief、Design、MVP）
- 应用与数据库相关文件均在 **MVP** 子目录：`/Users/michael/Desktop/HivePost/MVP`
- Vercel 新项目页面已打开
- GitHub 授权页面已打开（需您手动点击 **Authorize Vercel**）

---

## 一、您需要手动完成的步骤

### 步骤 1：完成 GitHub 授权

1. 在浏览器中切换到 **GitHub Authorize Vercel** 标签页
2. 点击 **Authorize Vercel** 按钮（若按钮为禁用，请稍等页面加载完成或刷新后重试）
3. 授权后会自动跳回 Vercel

### 步骤 2：创建 GitHub 仓库并推送代码

在终端执行（在项目根目录 **HivePost** 下）：

```bash
cd /Users/michael/Desktop/HivePost

# 1. 在 GitHub 上创建新仓库：https://github.com/new
#    仓库名建议：hivepost 或 content-generation-tool
#    选择 Public，不要勾选 "Add a README"

# 2. 添加 remote 并推送（将 YOUR_USERNAME 和 REPO_NAME 替换为实际值）
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git add -A
git commit -m "Initial commit: HivePost MVP"
git branch -M main
git push -u origin main
```

### 步骤 3：在 Vercel 中导入项目

授权完成后，Vercel 会显示您的 GitHub 仓库列表：

1. 选择刚推送的 **hivepost** 仓库（或您创建的名字）
2. 点击 **Import**
3. **重要**：将 **Root Directory** 设置为 `MVP`（Next.js 应用在此目录）
4. 点击 **Deploy**

### 步骤 4：配置环境变量

部署前或部署后，在 Vercel 项目 → **Settings** → **Environment Variables** 添加：

| 变量名 | 说明 | 生产环境值 |
|--------|------|------------|
| `NEXTAUTH_URL` | 生产 URL | `https://你的项目.vercel.app` |
| `NEXTAUTH_SECRET` | 随机密钥 | `openssl rand -base64 32` 生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth | 同本地 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | 同本地 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | 同本地 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | 同本地 |
| `OPENAI_API_KEY` | OpenAI | 同本地 |
| `REPLICATE_API_TOKEN` | Replicate | 同本地 |
| `FEEDBACK_INVITATION_DAYS` | （可选）反馈邀请天数 | `14` |

添加后需 **Redeploy** 才能生效。

### 步骤 5：Google OAuth 生产配置

在 [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials：

1. 编辑 OAuth 2.0 客户端
2. 在 **Authorized redirect URIs** 中添加：
   - `https://你的项目.vercel.app/api/auth/callback/google`

---

## 二、注意事项

- **Node 版本**：当前本机为 Node v19.8.1，Vercel CLI 需要 Node 20+。Vercel 云端构建使用 Node 20，不受影响。
- **Root Directory**：必须设为 `MVP`，否则 Vercel 找不到 Next.js 项目。
- **首次部署**：若构建失败，可在 Vercel 的 Deployments 页面查看构建日志。

---

## 三、部署后验证

1. 访问 `https://你的项目.vercel.app`
2. 测试 Google 登录
3. 创建业务并走完核心流程
