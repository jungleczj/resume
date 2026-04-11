<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_C1（可在整个开发周期中随时并行推进）
================================================================
【可并行开发 / 横切关注点】
前置依赖（必须先完成）：
  · SERIAL_01 产品总览（MVP 目标：用户分析全埋点 4 张 analytics 表）
  · SERIAL_02 双市场策略（CN/EN 独立追踪，payment_market 字段）

可与所有其他模块同时并行开发：
  · 埋点是横切关注点，埋点 SDK 封装完成后，各模块开发时按事件表接入即可
  · 与 PARALLEL_A1/A2 对齐：f1_upload_started / f2_notion_connected 等事件由各 Pipeline 模块触发
  · 与 PARALLEL_B1 对齐：achievement_dragged / photo_toggled / jd_pasted 由工作台模块触发
  · 与 PARALLEL_B2 对齐：payment_initiated / payment_completed / export_completed 由支付模块触发

本文件负责人交付物：
  · 4 张 analytics 表 Schema（events / sessions / funnels / revenue）
  · 统一 track() 埋点函数封装
  · 关键事件枚举文档（供各模块开发者参考接入）
  · 每日漏斗聚合 Cron Job

覆盖原文章节：第11章（11.1 分析目标 + 11.2 关键事件枚举）
================================================================
-->

# **11. 用户分析体系（v5.3 完整版）**
## **11.1 分析目标**
- 来源分析：国内vs海外用户比例、UTM渠道效果
- 漏斗分析：访问→F1激活→生成→付费→导出→注册（CN/EN分别追踪）
- 留存分析：D1/D7/D30留存率
- 收入分析：ARPU、付费转化率、LTV、各套餐占比
- 质量分析：占位符填写率、AI生成满意度、降级模型使用率

## **11.2 关键事件枚举**

|**事件名**|**触发时机**|**关键 properties**|
| :- | :- | :- |
|page\_view|每次页面访问|page\_path, referrer, utm\_\*|
|user\_signup|注册成功|method(google/email), payment\_market|
|f1\_upload\_started|开始上传简历|file\_type, file\_size|
|f1\_parse\_completed|解析完成进入工作台|parse\_duration\_ms, tier1/2/3\_count|
|jd\_pasted|粘贴JD|jd\_length|
|resume\_generated|生成定制简历|generation\_time\_ms, matched\_items, resume\_lang|
|achievement\_dragged|成就拖拽操作|action(replace/insert), from\_tab(confirmed/draft)|
|photo\_toggled|工具栏照片开关切换|state(on/off), has\_photo|
|photo\_uploaded|照片上传成功|source(auto/manual), market|
|f2\_notion\_connected|Notion授权成功|workspace\_id|
|f2\_achievements\_extracted|成就提取完成|task\_count, achievement\_count, duration\_ms|
|f2\_achievement\_confirmed|单条草稿确认|tier, had\_placeholder|
|export\_clicked|点击导出按钮|has\_jd, confirmed\_count, has\_photo|
|payment\_initiated|在导出弹窗选择套餐|plan\_type, format|
|payment\_completed|付款成功|plan\_type, amount\_usd, provider|
|export\_completed|文件下载成功|format, resume\_lang, has\_photo|
|post\_payment\_signup|付款后注册|time\_after\_payment\_sec|
|ai\_model\_fallback|千问不可用，切换Claude|from\_model, to\_model, reason|

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-C1 · 任务清单

### T-C1-1　Analytics 四张表 Schema + 索引
| 项 | 内容 |
|---|---|
| **输入** | PRD 11.2 事件枚举 + 分析目标（漏斗/留存/收入/质量） |
| **输出** | 四张表建表 SQL：`analytics_events / analytics_sessions / analytics_funnels / analytics_revenue`；关键索引 |
| **关键步骤** | `analytics_events`（`id, user_id, anonymous_id, event_name, properties jsonb, page_path, referrer, utm_*, geo_country, payment_market, created_at`）→ 索引：`(event_name, created_at)`, `(user_id)`, `(anonymous_id)` → `analytics_sessions`（`session_id, user_id, anonymous_id, started_at, ended_at, page_view_count, geo_country`）→ `analytics_funnels`（`date, market, visited, f1_uploaded, workspace_entered, generated, export_clicked, paid, registered`，每日聚合快照）→ `analytics_revenue`（`date, plan_type, amount_usd, transaction_count`） |
| **验收标准** | ① 四张表建表 Migration 文件存在，可幂等执行；② `analytics_events` 插入 10 万行后，按 `event_name + created_at` 查询 < 50ms；③ `properties` 字段可按 JSONB key 查询（如 `properties->>'file_type' = 'pdf'`）；④ 表存在适当的分区策略（按月分区 `created_at`，处理大数据量） |

### T-C1-2　统一埋点 SDK `track(eventName, properties)`
| 项 | 内容 |
|---|---|
| **输入** | 事件名（见 PRD 11.2 枚举）；业务 properties；当前用户上下文（自动附带） |
| **输出** | 写入 `analytics_events` 表；自动附带 `anonymous_id / user_id / page_path / payment_market / geo_country / utm_*` |
| **关键步骤** | 客户端：`useTrack()` hook → 从 `useAuth()` 获取 `user_id / payment_market` → 从 Cookie 读 `anonymous_id` → 从 URL params 读 `utm_*` → 从 `/api/geo` 读 `geo_country` → POST `body: {event_name, properties, ...context}` 到 `/api/analytics/track` → 服务端：写 `analytics_events` → 返回 204；防重复：同一 `session_id` 内相同事件（`page_view` 除外）相同参数 1s 内只写一次（Redis dedup key） |
| **验收标准** | ① 调用 `track('f1_upload_started', { file_type:'pdf', file_size:1024000 })`，`analytics_events` 表中出现对应行，`payment_market` / `anonymous_id` 自动填充；② 连续快速调用同一事件 10 次，DB 只写入 1-2 次（防重复生效）；③ UTM 参数（`?utm_source=google`）自动捕获并写入；④ `track()` 调用失败（网络断开），不影响主业务流程（try-catch 静默失败） |

### T-C1-3　各模块埋点接入（横切接入指南）
| 项 | 内容 |
|---|---|
| **输入** | PRD 11.2 的 18 个事件枚举；各模块开发代码 |
| **输出** | 所有 18 个事件在对应触发点均有 `track()` 调用；properties 字段完整 |
| **关键步骤** | 整理接入清单（哪个模块负责哪个事件）：A1→`f1_upload_started / f1_parse_completed`；A2→`f2_notion_connected / f2_achievements_extracted / f2_achievement_confirmed`；B1→`jd_pasted / resume_generated / achievement_dragged / photo_toggled / photo_uploaded`；B2→`export_clicked / payment_initiated / payment_completed / export_completed / post_payment_signup`；S01（Auth）→`user_signup`；全局→`page_view`；AI 模块→`ai_model_fallback` |
| **验收标准** | ① 执行完整 F1 用户路径，`analytics_events` 出现：`page_view → f1_upload_started → f1_parse_completed → jd_pasted → resume_generated → export_clicked → payment_initiated → payment_completed → export_completed`（顺序合理）；② 每个事件的 properties 字段与 PRD 11.2 枚举完全对应，无缺字段 |

### T-C1-4　每日漏斗聚合 Cron Job
| 项 | 内容 |
|---|---|
| **输入** | `analytics_events` 表中昨日数据 |
| **输出** | `analytics_funnels` 表写入昨日 CN/EN 两行漏斗数据；`analytics_revenue` 更新昨日收入 |
| **关键步骤** | Vercel Cron（每天 01:00 UTC）→ `SELECT count(distinct anonymous_id) FROM analytics_events WHERE event_name='page_view' AND created_at::date = yesterday AND payment_market='cn'` → 同理统计各漏斗步骤 → `UPSERT analytics_funnels`；同时聚合 `payment_records` 昨日收入写 `analytics_revenue` |
| **验收标准** | ① 手动触发 Cron，`analytics_funnels` 表当天生成 CN/EN 两行；② 漏斗数字逻辑正确：`paid ≤ export_clicked ≤ generated ≤ workspace_entered ≤ f1_uploaded ≤ visited`；③ Cron 失败时写入错误日志，不导致服务中断 |

### T-C1-5　Session 追踪
| 项 | 内容 |
|---|---|
| **输入** | `page_view` 事件；30 分钟无活动 = session 结束 |
| **输出** | `analytics_sessions` 表记录每个 session 的起止时间和 pageview 数量 |
| **关键步骤** | 客户端：`sessionStorage` 存 `session_id`（UUID，每次 tab 新开生成新 session）→ `track('page_view')` 携带 `session_id` → 服务端：Redis key `session:{session_id}`（TTL 30分钟，每次 page_view 刷新）→ key 过期时（Redis keyspace event）写入 `analytics_sessions.ended_at` |
| **验收标准** | ① 新开浏览器 Tab，生成新 `session_id`；② 同一 Tab 内 30 分钟无操作后，`analytics_sessions` 记录 `ended_at`；③ `page_view_count` 与该 session 实际访问页面数一致 |

---

## AC-C1 · 模块整体验收标准

1. **埋点完整性**：执行 F1 付费完整路径，`analytics_events` 表中出现全部预期事件，无缺漏
2. **性能无影响**：埋点 API 调用为异步非阻塞，主业务链路（上传/生成/支付）P99 耗时无明显增加（ < 50ms 差异）
3. **漏斗数据准确性**：手动执行 10 次完整 F1 路径（5 CN + 5 EN），次日漏斗数据与手动计数一致
4. **数据隔离**：`payment_market` 字段确保 CN/EN 数据完全独立，不出现混合统计
5. **运营看板可用**：提供基础 SQL 查询（5 个关键指标：转化率/留存/ARPU/成就确认率/占位符填写率），可直接在 Supabase Dashboard 运行
