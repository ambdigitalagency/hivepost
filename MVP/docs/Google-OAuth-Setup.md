# Google OAuth 配置说明（阶段 2.1）

HivePost 使用 **Google 登录**，需要先在 Google Cloud 创建 OAuth 2.0 凭据。

## 步骤

1. **打开 Google Cloud Console**  
   https://console.cloud.google.com/

2. **创建或选择项目**  
   - 若无项目：点击顶栏「选择项目」→「新建项目」，输入名称（如 `HivePost`）并创建。  
   - 若已有项目：直接选中该项目。

3. **启用 Google+ API / 身份相关 API**  
   - 左侧菜单：**API 和服务** → **库**。  
   - 搜索并启用 **Google+ API**（若已弃用，则确保已启用与登录相关的 API；当前 Google 登录通常使用「Google Identity」相关配置即可，无需单独启用旧版 Google+ API）。  
   - 实际上仅用「登录用 Google 账号」时，多数情况下只需在「凭据」中创建 OAuth 客户端，不强制要求先启用某个具体 API；若创建凭据时提示需要配置 OAuth 同意屏幕，按下面步骤操作即可。

4. **配置 OAuth 同意屏幕**  
   - 左侧：**API 和服务** → **OAuth 同意屏幕**。  
   - 用户类型选「外部」（若仅自己用可先选「内部」）。  
   - 填写应用名称（如 `HivePost`）、用户支持邮箱，保存并继续；作用域可先不添加，再继续到「测试用户」（外部时）可添加自己的邮箱。  
   - 保存。

5. **创建 OAuth 2.0 凭据**  
   - 左侧：**API 和服务** → **凭据**。  
   - 点击「创建凭据」→「OAuth 客户端 ID」。  
   - 应用类型选「Web 应用」。  
   - 名称随意（如 `HivePost Web`）。  
  - **已授权的 JavaScript 来源**：  
     - 本地：`http://localhost:3001`（dev 固定端口，见 docs/DEV-PORT.md）  
     - 上线后补充：`https://你的域名`  
  - **已授权的重定向 URI**：  
     - 本地：`http://localhost:3001/api/auth/callback/google`  
     - 上线后补充：`https://你的域名/api/auth/callback/google`
   - 创建后得到 **客户端 ID** 和 **客户端密钥**。

6. **写入本地环境变量**  
   - 在 MVP 目录下复制示例文件并填写：  
     `cp .env.example .env.local`  
   - 编辑 `.env.local`，填入：  
     - `GOOGLE_CLIENT_ID` = 你的客户端 ID  
     - `GOOGLE_CLIENT_SECRET` = 你的客户端密钥  
     - `NEXTAUTH_SECRET` = 任意随机长字符串（如 `openssl rand -base64 32` 生成）  
     - `NEXTAUTH_URL` = 本地开发用 `http://localhost:3001`（dev 固定端口）

完成后即可在本地使用「使用 Google 登录」；上线时在 Google 凭据中补上生产环境的来源与重定向 URI，并在 Vercel 等平台配置同名环境变量。
