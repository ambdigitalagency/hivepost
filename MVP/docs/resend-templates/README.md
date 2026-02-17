# Resend 验证邮件模板

## 发件人邮箱：noreply@email.amb.ltd

- 你当前在 Resend 里设置的域名是 **email.amb.ltd**，发件人应使用：**noreply@email.amb.ltd**。
- 在 Resend 模板编辑器顶部 **From** 处选择或填写该地址（或带显示名，如 `HivePost <noreply@email.amb.ltd>`）。

## 在 Resend 里使用本模板

1. 打开 Resend → **Templates** → 当前模板编辑器。
2. **From**：设为 `noreply@email.amb.ltd`（见上）。
3. **Subject**：
   - 中文模板用：`邮箱验证`
   - 英文模板用：`Verify your email`
4. 正文：按 Resend 提示按 **/** 或 **⌘K** 打开命令，选择插入 **HTML** 块，将下面对应文件内容**整段粘贴**进去：
   - 中文：复制 `verification-email-zh.html` 全部内容。
   - 英文：复制 `verification-email-en.html` 全部内容。
5. 占位符 **`{{code}}`**：发信时由你的 API 替换为实际验证码或验证链接。
6. 点 **Publish** 发布模板。

## 文件说明

| 文件 | 用途 |
|------|------|
| `verification-email-zh.html` | 中文验证邮件正文（你的邮箱验证码是：{{code}}） |
| `verification-email-en.html` | 英文验证邮件正文（Your email verification code is: {{code}}） |

样式已内联，兼容常见邮件客户端；白底卡片 + 灰底外框，简单清晰。
