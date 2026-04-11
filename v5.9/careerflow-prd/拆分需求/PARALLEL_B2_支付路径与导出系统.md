<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_B2（与 PARALLEL_B1、PARALLEL_B3 并行）
================================================================
【可并行开发】
前置依赖（必须先完成）：
  · SERIAL_01 产品总览（MVP 范围：Creem 国际支付 ≤3步）
  · SERIAL_02 双市场策略（CN 免费直接下载 vs. EN 付费弹窗；
               支付墙热更新机制 DB+Redis 在此处落地实现）

可与以下模块同时并行开发：
  · PARALLEL_B1（同屏工作台）：支付弹窗由工作台「导出」按钮触发，
                                 接口层由 B2 提供，UI 触发点在 B1
  · PARALLEL_B3（安全合规）：导出文件签名 URL 的生成需参考安全规范
  · PARALLEL_C1（用户分析）：payment_initiated / payment_completed 等埋点

注意：
  · 导出文件生成（PDF/DOCX）也属于本模块，包含 Browserless 备用方案
  · 匿名付款→注册后数据迁移 与 Auth 模块有接口约定，需提前对齐

覆盖原文章节：第7章（7.1–7.3 支付路径与导出）+ 第10章（10.1–10.2 支付策略全量）
================================================================
-->

# **7. 支付路径（v5.9 缩短至3步）**
旧路径：点导出→中间确认页→选套餐→跳转支付→支付→返回→下载，≥6步。新路径：点导出→弹出选格式+套餐→一键Pay Now→支付完成文件就绪，≤3步。
## **7.1 导出支付弹窗（新设计）**
┌─────────────────────────────────────────────┐

│  导出你的简历                          [✕]  │

│                                             │

│  格式：[● PDF]  [○ DOCX]                   │

│                                             │

│  ┌─────────────────────────────────────┐   │

│  │  ● 单次导出      $4.99              │   │

│  │    下载这份简历                      │   │

│  └─────────────────────────────────────┘   │

│  ┌─────────────────────────────────────┐   │

│  │  ○ 订阅会员      $9.9/月  ★推荐     │   │

│  │    无限导出 + Notion同步 + 多版本管理│   │

│  └─────────────────────────────────────┘   │

│                                             │

│  [Pay Now  →]                               │

│                                             │

│  付款成功后立即下载，安全加密 🔒             │

└─────────────────────────────────────────────┘

## **7.2 支付完成后流程**

|**场景**|**流程**|**用户感知**|
| :- | :- | :- |
|CN用户（免费）|点导出→选格式→直接下载（无支付弹窗）|即时下载|
|EN用户→单次付款|点导出→弹窗→Pay Now→Creem→支付→页面返回显示「✅ 文件已就绪」→下载|≤3步，30秒内完成|
|EN用户→已订阅|点导出→选格式→直接生成（无付款，已订阅）|即时，类似CN体验|
|付款后匿名用户|支付成功后：注册引导卡（非弹窗，可关闭）→ 注册 → anonymous\_id数据迁移|引导卡不阻断下载|

## **7.3 导出前提示（非阻断）**
- 简历含未填占位符🟡：顶部提示「简历中有X处待补充数字，建议完善后导出」→ 不阻断导出
- 导出文件命名：「姓名\_职位\_日期.pdf」（如：张三\_产品经理\_2026-03.pdf）
- 导出队列：max 2并发；超时60s → 切换Browserless.io备用 → 发邮件下载链接兜底

# **10. 支付策略（v5.4-v5.5 完整版）**
## **10.1 支付墙热更新**
- 配置存 paywall\_settings DB表，Redis 60s缓存
- Admin API修改DB → 删除Redis key → 60s内全站生效，无需发版
- DB故障兜底：paywall\_defaults.ts 静态默认值（CN免费，EN $4.99）
- Admin API权限：x-admin-token + IP白名单双重校验 + 操作日志
## **10.2 支付健壮性**

|**场景**|**处理**|**用户感知**|
| :- | :- | :- |
|Webhook重复到达|Redis幂等锁（5分钟NX key）|透明，无重复扣款|
|支付成功但文件未生成|导出队列（max 2并发）→ Realtime推送 → 超时发邮件|「生成中」状态；超时收邮件|
|匿名付款→注册|anonymous\_id + anonymous\_payment\_map；注册时迁移成就库+简历+照片|注册后全部数据迁移|
|订阅到期未续费|宽限7天→降级→邮件提醒|Dashboard显示「已到期」|
|退款申请|Creem退款API→立即降级→邮件确认；已生成文件不删除|邮件通知退款成功|
|续订扣款失败|宽限7天不降级；邮件提醒更新支付方式|邮件提醒|

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-B2 · 任务清单

### T-B2-1　导出支付弹窗 UI
| 项 | 内容 |
|---|---|
| **输入** | `payment_market`；订阅状态；实时 `paywall_settings`（价格） |
| **输出** | CN 用户：格式选择 Sheet（PDF/DOCX）→ 直接下载；EN 未付款：支付弹窗（格式 + 套餐 + Pay Now）；EN 已订阅：格式选择 Sheet→ 直接生成 |
| **关键步骤** | 「导出」按钮 onClick → 读取 `usePaywall()` hook → 分支渲染：CN/已订阅 → `<FormatSheet>` Modal（仅格式选择，无价格）；EN 未付款 → `<PaymentModal>`（格式 Radio + 套餐 Radio 卡片 + Pay Now 按钮）→ 价格从 `paywall_settings` Redis 缓存实时读取 → 默认选中「单次导出」 |
| **验收标准** | ① CN 用户点「导出」，弹出格式选择（仅 PDF/DOCX 选项），无任何价格信息；② EN 未订阅用户，弹出完整支付弹窗，价格显示与 DB 一致；③ 修改 DB 价格后 60s 内，支付弹窗中价格自动更新；④ 弹窗 ✕ 关闭后可重新点「导出」再次打开 |

### T-B2-2　Creem 支付发起 `POST /api/payment/create-session`
| 项 | 内容 |
|---|---|
| **输入** | `plan_type: 'one_time'｜'monthly'｜'yearly'`；`format: 'pdf'｜'docx'`；`anonymous_id`（未登录时）；`resume_version_id` |
| **输出** | Creem Checkout URL；`payment_records` 表新增 `status='pending'` 记录；前端跳转到 Creem 付款页 |
| **关键步骤** | 服务端 → 查 Creem API 创建 Checkout Session（携带 `success_url / cancel_url`）→ 写 `payment_records`（记录 `plan_type / amount / anonymous_id / resume_version_id`）→ 返回 `{ checkoutUrl }` → 前端 `window.location.href = checkoutUrl` |
| **验收标准** | ① 返回的 URL 是合法的 Creem Checkout URL（以 `https://checkout.creem.io` 开头）；② `payment_records` 表新增一行，`status='pending'`；③ 未登录用户（仅有 `anonymous_id`）同样可发起支付，`anonymous_id` 字段正确写入；④ Creem 测试环境：使用测试卡号完成支付，页面跳回 `success_url` |

### T-B2-3　Creem Webhook 处理 `POST /api/webhooks/creem`
| 项 | 内容 |
|---|---|
| **输入** | Creem Webhook POST 请求（`payment.completed / subscription.cancelled / subscription.renewed / payment.refunded`）；Webhook 签名 header |
| **输出** | 幂等处理（重复到达不重复处理）；`payment_records` / `subscriptions` 表更新；Realtime 推送付款成功；触发文件生成任务 |
| **关键步骤** | 验签（HMAC-SHA256）→ 失败返回 400 → Redis NX key `webhook:creem:{payment_id}`（TTL 5分钟）→ key 已存在 → 返回 200（幂等忽略）→ key 不存在 → 处理：`payment.completed` → 更新 `payment_records.status='completed'` → 若订阅则写/更新 `subscriptions` → `supabase.channel` 推送 `{event:'payment_success', format}` → 触发导出任务；`subscription.renewed` → 更新 `current_period_end`；`payment.refunded` → 降级订阅 + 邮件 |
| **验收标准** | ① 重复发送同一 Webhook 2 次，`payment_records` 只更新 1 次（幂等验证）；② 支付成功后工作台实时出现「✅ 文件已就绪」（Realtime 推送 ≤ 5s）；③ 伪造签名的 Webhook 请求返回 400；④ 订阅续费 Webhook，`subscriptions.current_period_end` 正确更新 |

### T-B2-4　PDF 生成服务
| 项 | 内容 |
|---|---|
| **输入** | `resume_version_id`（或直接传 TipTap JSON）；`include_photo: boolean`；`photo_storage_path`（可选） |
| **输出** | PDF 文件 Buffer；上传到 Storage 临时路径；返回签名 URL（24h 有效）；文件命名「姓名\_职位\_日期.pdf」 |
| **关键步骤** | 将 TipTap JSON 转为 HTML（与编辑器 CSS 共享变量）→ 照片处理：`include_photo=true` → 从 Storage 读取照片 → base64 内嵌 HTML → 使用 Puppeteer / Playwright 渲染 HTML → `page.pdf()`（A4，边距配置）→ 超时 60s → 切 Browserless.io（`BROWSERLESS_API_KEY`）→ 仍失败 → 写入 `export_jobs` 表（`status='failed'`）→ 发邮件兜底；成功 → 上传 Storage → `createSignedUrl(path, 86400)` → 返回 |
| **验收标准** | ① 生成的 PDF 可正常打开，无乱码；② 照片 `include_photo=true` 时，PDF 右上角显示照片；③ 签名 URL 24h 后访问返回 403（过期）；④ 文件命名符合「姓名\_职位\_日期.pdf」格式；⑤ 模拟 Puppeteer 超时（>60s），自动切换 Browserless 备用方案，不向用户报错 |

### T-B2-5　DOCX 生成服务
| 项 | 内容 |
|---|---|
| **输入** | TipTap JSON；`include_photo: boolean`；`photo_storage_path` |
| **输出** | `.docx` 文件；签名 URL（24h） |
| **关键步骤** | 使用 `docx` npm 包 → 遍历 TipTap JSON 节点 → 映射为 `docx` Paragraph / TextRun / Table → 照片：`include_photo=true` → 读取照片 Buffer → `docx.ImageRun`（嵌入右上角）→ `Packer.toBuffer()` → 上传 Storage → 签名 URL |
| **验收标准** | ① 生成的 DOCX 可用 Word / WPS 正常打开；② 照片正确嵌入 DOCX 对应位置；③ 中文内容无乱码；④ 生成耗时 ≤ 10s |

### T-B2-6　导出队列与 Realtime 状态推送
| 项 | 内容 |
|---|---|
| **输入** | 付款成功事件（Webhook） / CN 用户直接触发 |
| **输出** | 队列控制最大并发 2；状态实时推送到前端；工作台显示「生成中...」→「✅ 文件已就绪」→「下载」按钮 |
| **关键步骤** | `export_jobs` 表（`status: queued/processing/done/failed`）→ 队列处理函数：`SELECT ... WHERE status='queued' LIMIT 1 FOR UPDATE SKIP LOCKED`（乐观锁，最多 2 个并发）→ 处理完成 → 更新 `status='done'` + `download_url` → Supabase Realtime 推送 `{event:'export_done', url}` → 前端显示「✅ 文件已就绪」+ 自动触发下载 |
| **验收标准** | ① 同时发起 5 个导出任务，同一时刻处于 `processing` 状态的不超过 2 个；② 文件生成后前端自动弹出下载（无需用户手动点「下载」）；③ 导出失败（Puppeteer+Browserless 均失败），用户收到含下载链接的邮件（< 5 分钟内） |

### T-B2-7　匿名付款→注册后数据迁移
| 项 | 内容 |
|---|---|
| **输入** | 付款成功后注册引导卡；用户完成注册；`anonymous_id` Cookie |
| **输出** | `anonymous_id` 关联的所有数据迁移到新 `user_id`；Cookie 清除 |
| **关键步骤** | 注册成功 → `migrateAnonymousData(anonymousId, userId)` → 事务：`UPDATE achievements SET user_id=$2 WHERE anonymous_id=$1`；同样迁移 `resume_versions / uploaded_files / payment_records`；写 `anonymous_payment_map.user_id + migrated_at`；删 Cookie `anonymous_id` |
| **验收标准** | ① 注册后，工作台成就库数据完整（与注册前一致，无丢失）；② 付款记录与新账号关联（订单历史页面可见）；③ `anonymous_id` Cookie 已清除（DevTools 验证）；④ 迁移操作在 DB 事务中执行，中途失败不出现部分迁移状态 |

---

## AC-B2 · 模块整体验收标准

1. **完整支付 E2E**（Creem 测试环境）：点导出 → 选套餐 → Pay Now → Creem 测试卡支付 → 返回工作台 → 文件自动下载，全流程 ≤ 30s
2. **幂等性压测**：向 Webhook 端点发送同一 `payment_id` 的请求 10 次，`payment_records` 只更新 1 次
3. **PDF 质量验收**：用 10 份不同格式的简历生成 PDF，均可在 Mac/Windows 正常打开，无乱码，照片正确嵌入
4. **退款流程**：触发退款 → 用户立即无法导出（降级）→ 邮件到达（< 5 分钟）→ 已生成文件链接仍可访问（不删除）
5. **订阅状态机**：到期 → 宽限期 7 天 → 期间仍可使用 → 宽限期结束降级 → 邮件通知
