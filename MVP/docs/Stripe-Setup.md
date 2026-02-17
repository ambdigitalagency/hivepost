# Stripe 设置步骤（产品 + 月付价格）

按下面步骤在 Stripe 里创建一个「月付订阅」产品，并拿到 **Price ID**（`price_xxxxx`），用于 Vercel 的 `STRIPE_PRICE_ID`。

---

## 1. 确认在「测试模式」

- 打开 [Stripe Dashboard](https://dashboard.stripe.com)。
- 右上角若显示 **Test mode**（或「测试模式」）即正确；若显示 **Live**，点一下切换为 Test mode。
- 开发/试用阶段用测试模式即可，正式收费再切 Live 并新建正式产品。

---

## 2. 新建产品（Product）

1. 左侧菜单点 **Product catalog**（产品目录）→ **Products**。
2. 点 **+ Add product**（添加产品）。
3. 填写：
   - **Name**：例如 `HivePost 月付` 或 `HivePost Monthly`（显示在账单和 Checkout 里）。
   - **Description**（可选）：例如「每月订阅，含 28 天试用」。
   - **Image**（可选）：产品图，可先不传。
4. **不要**点「Save product」——先做下一步「添加价格」。

---

## 3. 添加月付价格（Price）

在同一页面向下，找到 **Pricing** 区块：

1. **Pricing model** 选 **Standard pricing**（标准定价）。
2. **Price**：
   - 选 **Recurring**（定期/订阅）。
   - **Billing period** 选 **Monthly**（每月）。
   - **Price** 填金额，例如 `10`，右边选你的货币（如 **USD**）。
3. 若有 **Free trial**（免费试用）：
   - 如需 28 天试用，可在这里设 **Trial period** 为 28 天；  
   - 若你的应用在 Checkout 里已经用 `subscription_data.trial_period_days` 控制试用，这里可以填 0 或不勾选，以代码为准。
4. 点 **Add price**（或先 **Save product** 再在产品详情里 **Add another price**）。

---

## 4. 保存并拿到 Price ID

1. 点 **Save product** 保存产品（若刚才没保存）。
2. 进入该产品的详情页后，在 **Pricing** 区域会看到刚加的「月付」价格。
3. 点击该价格那一行，或鼠标悬停，会看到 **Price ID**，形如：`price_1ABC123xyz...`。
4. 点击 Price ID 右侧的「复制」图标，或选中整段复制。
5. 把这个 **Price ID** 填到 Vercel 环境变量 **STRIPE_PRICE_ID** 里（见 [VERCEL-ENV-SETUP.md](../VERCEL-ENV-SETUP.md)）。

---

## 5. 小结

| 在 Stripe 里要做的事 | 结果 |
|----------------------|------|
| 开 Test mode | 用测试卡号跑通流程 |
| 新建 1 个产品 | 例如「HivePost 月付」 |
| 为该产品添加 1 个「按月」价格 | 得到 **Price ID**（`price_xxxxx`） |
| 复制 Price ID 到 Vercel | 填到 `STRIPE_PRICE_ID` |

**测试卡号**（Stripe Test mode）：  
- 卡号可用 `4242 4242 4242 4242`，过期和 CVC 随便填未来日期和三位数即可。

---

## 可选：Webhook（订阅状态同步）

若应用需要根据「用户订阅创建/更新/取消」更新数据库（例如写 `stripe_customer_id`、试用结束时间）：

1. Stripe Dashboard → **Developers** → **Webhooks**。
2. **Add endpoint**，Endpoint URL 填：`https://你的域名/api/stripe/webhook`（如 `https://hivepost.vercel.app/api/stripe/webhook`）。
3. 选择事件，例如：`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`（按你代码里用到的选）。
4. 添加后得到 **Signing secret**（`whsec_...`），填到 Vercel 的 **STRIPE_WEBHOOK_SECRET**。

若你已经按项目文档配过 Webhook，可跳过此步。
