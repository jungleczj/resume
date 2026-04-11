<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：SERIAL_02（串行第2步，所有涉及付费/市场判断模块的前置依赖）
================================================================
【串行 / 前置依赖：SERIAL_01】
本文件定义双市场的核心规则，是以下所有模块的前置条件：
  · PARALLEL_A1 / A2（F1/F2 Pipeline）：需知道 CN/EN 市场差异
  · PARALLEL_B1（工作台）：语言切换默认值、照片默认状态
  · PARALLEL_B2（支付与导出）：付费逻辑、支付墙热更新机制
  · PARALLEL_B3（安全合规）：GDPR 仅 EN 市场要求
  · PARALLEL_C1（用户分析）：CN/EN 独立追踪逻辑

覆盖原文章节：第2章（2.1–2.4）
================================================================
-->

# **2. 双市场策略**
## **2.1 国内：Phase 1 完全免费**
⭐ 国内MVP Phase 1完全免费，无任何月度限制，无达限行为，无强制引导。用户可无限使用所有功能（F1/F2/生成/导出/照片），成就库无上限。

|**项目**|**Phase 1（MVP，当前）**|**Phase 2（付费，待启动）**|
| :- | :- | :- |
|AI生成/导出/照片|无限制|月额度/订阅|
|成就库条数|无限制|待定|
|达限行为|无|留邮箱/引导付费|
|支付提供商|无（不收费）|支付宝+CNY（Phase 2A）|
|配置开关|paywall\_settings.cn.enabled=false|paywall\_settings.cn.enabled=true|

## **2.2 国际：Creem 付费**

|**层级**|**内容**|**价格（USD）**|
| :- | :- | :- |
|免费预览|AI美化预览（不可导出）/ 成就库无限 / 简历生成预览|免费|
|按次导出|单次JD定制简历 + PDF/DOCX 导出（含照片若已添加）|$4.99 / 次|
|月订阅|无限导出 / Notion持续同步 / 多版本管理|$9.9 / 月|
|年订阅|同月订阅，更优惠|$79 / 年（≈$6.6/月）|

## **2.3 支付墙热更新（v5.5，DB+Redis）**
配置存 paywall\_settings DB表，Redis 60s缓存。Admin API修改DB后60秒内全站生效，无需发版。DB故障时 paywall\_defaults.ts 静态兜底。Admin API：x-admin-token + IP白名单 + 操作日志。
## **2.4 Geo 边界（v5.3 设计，保持不变）**

|**字段**|**数据来源与用途**|**备注**|
| :- | :- | :- |
|ui\_lang|Vercel geo.country → 决定默认界面语言（/zh 或 /en），仅UI|可被用户手动覆盖|
|payment\_market|用户注册/首次付费时主动确认写入 profiles 表；cn\_free \| en\_paid；决定是否收费|不依赖geo，防VPN绕过|
|geo\_country|原始geo（Vercel提供）→ 仅存DB做分析，不参与任何付费决策|用于运营看板|

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-S02 · 任务清单

### T-S02-1　`payment_market` 写入与确认弹窗
| 项 | 内容 |
|---|---|
| **输入** | 用户注册事件（Google OAuth 回调 / 邮箱注册）；用户点击「我在中国大陆」或「我在其他地区」 |
| **输出** | `profiles.payment_market = 'cn_free'` 或 `'en_paid'`；写入后不再重复弹出确认 |
| **关键步骤** | 注册完成后检测 `profiles.payment_market` 是否为 null → 为 null 则渲染确认弹窗（Modal）→ 用户选择后 `PATCH /api/profiles` 写入；对于匿名用户：根据 `x-geo-country` header 临时推断，不写 DB，首次付款时再确认 |
| **验收标准** | ① 新注册用户首次进入工作台，必然触发确认弹窗；② 选择后刷新页面不再弹出；③ `profiles` 表中 `payment_market` 字段不为 null；④ 无法通过修改 geo（VPN 模拟）改变已写入的 `payment_market` |

### T-S02-2　`paywall_settings` DB 表 + Redis 60s 缓存
| 项 | 内容 |
|---|---|
| **输入** | Admin API 请求（`PUT /api/admin/paywall-config`，带 `x-admin-token` + IP 白名单校验） |
| **输出** | DB 更新成功；Redis key `paywall:config` 删除（强制失效）；全站 60s 内读到新配置 |
| **关键步骤** | 创建 `paywall_settings` 表（单行，`id=1`）→ 封装 `getPaywallConfig()` 函数（Redis → DB → 静态兜底三级）→ Admin PUT 路由（双重鉴权）→ 写 DB → `redis.del('paywall:config')` → 操作日志落表 |
| **验收标准** | ① `paywall_defaults.ts` 存在，CN 默认 `enabled=false`，EN 默认 `$4.99`；② Admin API 修改价格后，60s 内前端弹窗显示新价格（无发版）；③ 故意断开 DB 连接，前端仍能读到兜底默认值，不报 500；④ 未携带正确 `x-admin-token` 的请求返回 401；⑤ 非白名单 IP 请求返回 403 |

### T-S02-3　CN 市场免费逻辑门控
| 项 | 内容 |
|---|---|
| **输入** | 用户 `payment_market`；`getPaywallConfig()` 返回的 `cn.enabled` |
| **输出** | CN 用户点「导出」→ 直接进格式选择（无支付弹窗）；EN 用户→ 触发支付弹窗 |
| **关键步骤** | 封装 `usePaywall()` hook → 读取当前用户 `payment_market` + 实时 paywall config → 返回 `{ isFree: boolean, prices: {...} }` → 工作台「导出」按钮根据 `isFree` 决定行为 |
| **验收标准** | ① `payment_market=cn_free` 用户，点「导出」直接弹格式选择，无价格卡片；② `payment_market=en_paid` 用户，点「导出」弹支付弹窗；③ 将 DB `cn_enabled` 改为 `true`（模拟未来付费），CN 用户立刻触发支付弹窗（60s 内生效，无需重新登录） |

### T-S02-4　`geo_country` 分析字段写入
| 项 | 内容 |
|---|---|
| **输入** | `x-geo-country` header（来自 Middleware） |
| **输出** | `analytics_events` 每条记录带 `geo_country` 字段；`profiles.geo_country` 在注册时写入（只写一次） |
| **关键步骤** | 埋点 SDK（见 PARALLEL_C1）自动从 API 响应 header 或 `/api/geo` 接口读取 geo，附加到每次 `track()` 调用中 |
| **验收标准** | ① `analytics_events` 表中的记录，`geo_country` 字段均不为 null；② `profiles.geo_country` 与注册时的 Vercel geo 一致；③ 修改 VPN 后再次访问，`geo_country` 记录新地区，但 `payment_market` 不变 |

---

## AC-S02 · 模块整体验收标准

1. `payment_market` 是唯一付费决策依据，任何地方不得直接读取 `geo_country` 做付费判断
2. CN 用户全链路（注册→工作台→导出）无任何付费相关 UI 出现（`cn_enabled=false` 时）
3. `getPaywallConfig()` 函数有完整单元测试：覆盖 Redis 命中、Redis miss、DB 故障三种场景
4. Admin 热更新 E2E 测试：修改价格 → 等待 < 60s → 前端读到新价格
5. 操作日志表中每次 Admin 写操作均有记录（时间戳/操作人/修改前后值）
