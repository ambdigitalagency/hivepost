# 开发端口固定为 3001

**HivePost MVP 开发服务器固定使用端口 3001。**

## 配置

- **package.json**：`"dev": "next dev -p 3001"`
- **.env.local**：`NEXTAUTH_URL=http://localhost:3001`
- **Google OAuth**：已授权的来源与重定向 URI 须包含 `http://localhost:3001` 及 `http://localhost:3001/api/auth/callback/google`

## 访问地址

本地开发：http://localhost:3001

## 注意

- 不要将 dev 端口改为 3000 或其他端口
- 新增环境变量或第三方配置（OAuth、回调 URL 等）时，统一使用 `http://localhost:3001`
