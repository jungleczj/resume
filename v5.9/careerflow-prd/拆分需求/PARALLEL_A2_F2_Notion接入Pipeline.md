<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_A2（与 PARALLEL_A1 完全并行，互不依赖）
================================================================
【可并行开发】
前置依赖（必须先完成）：
  · SERIAL_01 产品总览
  · SERIAL_02 双市场策略
  · SERIAL_03 AI三档美化引擎（F2 提取后同样调用 beautifyAchievement()
               + 草稿评分算法 + 智能预选 Top 6）

可与以下模块同时并行开发：
  · PARALLEL_A1（F1 Pipeline）：两条入口路径完全独立，无代码共享
  · PARALLEL_B3（安全合规）：Notion 最小权限设计可同步确认
  · PARALLEL_C2（选项库数据）：Step 0.1 基本信息需要用到选项库，
                                 但选项库是静态数据，可先用空数据联调

本文件负责人交付物：
  · Step 0.1 基本信息填写页面（纯新用户，全选择式）
  · Notion OAuth 接入（最小权限 read_content + read_databases）
  · Notion Token 有效性探测与续期管理
  · 后台三阶段提取任务（拉取→美化→评分→Realtime推送）
  · 草稿 Tab 审核交互（逐条 ✓/✎/✗，支持批量）

覆盖原文章节：第3.2节（F2主流程）+ 第4.1节（F2 Notion三阶段Pipeline）
              + 第9.4节（Notion Token续期管理）
================================================================
-->

## **3.2 F2 主流程（Notion接入）**
**Step 0**  【路径判断】有F1简历 → 跳 Step 1；无F1简历（纯新用户）→ 先 Step 0.1

**Step 0.1**  【基本信息填写（纯新用户）】全选择式，目标2分钟内完成

|**填写项**|**交互方式**|**说明**|
| :- | :- | :- |
|工作经历（1-3条）|公司名搜索（500强库）+ 职位标签选择（预置100个）+ 时间选择器|至少1条，支持自定义|
|教育背景|学校搜索 + 专业标签 + 学历下拉|可选，跳过不影响|
|技能标签|标签云多选（预置300个，分类展示）+ 搜索 + 自定义，上限20个|推荐填写，提升匹配质量|

↳  ❌ 不在此步设置语言（移到工作台）/ 不在此步上传照片（移到工作台）/ 不设目标国

**Step 1**  【连接 Notion】点「连接 Notion」→ OAuth授权（最小权限）→ 保存token → 触发后台任务

**Step 2 ★**  【立即进入工作台】不等待提取完成

↳  左下成就区：「🔄 正在从 Notion 提取成就... [阶段1/3 提取→2/3 美化→3/3 完成]」进度条

↳  右侧简历预览：有F1历史→显示美化简历；纯新用户→骨架+AI智能预选草稿（Top6，评分后）

**Step 3**  【成就完成】Realtime推送 → 左下草稿Tab更新徽章 → 简历预览自动刷新

↳  提示卡（非弹窗）：「✨ 发现12条成就草稿，点击「草稿」Tab查看并确认」

**Step 4**  【草稿审核】左下「草稿」Tab → 逐条 ✓确认 / ✎编辑后确认 / ✗忽略（支持批量）

↳  含占位符的草稿（第二档）：确认时内联填写框弹出，可填后确认，也可直接确认（占位符保留）

**Step 5**  粘贴JD → 生成 → 拖拽调整成就 → 导出（同F1 Step 3-4）

## **4.1 F2 Notion成就三档美化 Pipeline**

|**阶段**|**操作**|**前端进度显示**|
| :- | :- | :- |
|阶段1/3|拉取Notion已完成任务；AI一次调用批量提取成就文本；按notion\_task\_id去重|「正在提取成就...」|
|阶段2/3|逐条三档美化（5条/批并行）；第二档插入占位符；写tier标记；评分|「正在美化成就（12/30）...」|
|阶段3/3|评分→智能预选Top6→保存draft→Realtime推送→简历预览更新|「✨ 完成！发现12条成就」|

## **9.4 Notion Token 续期管理（v5.7）**
- Notion access\_token 本身不过期，但用户可能撤销授权
- 每次同步前探测token有效性；失效 → notion\_connections.status='expired' → Realtime推送侧边栏黄色提示「Notion需要重新授权」
- 用户撤销：停止同步；已confirmed成就保留；草稿清除
- 重新连接：清空旧draft，重新拉取（confirmed成就保留）

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-A2 · 任务清单

### T-A2-1　Step 0.1 基本信息填写页面
| 项 | 内容 |
|---|---|
| **输入** | 用户选择/输入：工作经历（1-3条）、教育背景（可选）、技能标签（≤20个）；数据来源：`seed_companies / seed_positions / seed_schools / seed_skills` 表（见 PARALLEL_C2） |
| **输出** | 写入 `work_experiences`、`education`、`user_skills` 表；页面跳转到 Step 1（Notion OAuth） |
| **关键步骤** | 公司名搜索（防抖 300ms → `ilike` 查 `seed_companies`，支持自由输入）→ 职位标签多选（前端本地过滤 `seed_positions`，支持自定义「+添加」）→ 时间选择器（月/年，「至今」复选框）→ 支持 1-3 条经历（「+添加工作经历」）→ 教育背景（可整体跳过）→ 技能标签云（分类展示，上限 20 个校验）→ 全部写 DB → 跳转 |
| **验收标准** | ① 未填任何工作经历时，「下一步」按钮 disabled；② 技能标签已选 20 个，再点第 21 个，Toast 提示「最多20个」，不可选中；③ 自定义公司名输入「小微公司ABC」，`work_experiences` 表写入该值（非搜索结果）；④ 跳过教育背景，流程正常进入下一步；⑤ 整个页面操作 ≤ 2 分钟（用户测试基准） |

### T-A2-2　Notion OAuth 接入 `GET /api/f2/notion/auth` + Callback
| 项 | 内容 |
|---|---|
| **输入** | 用户点击「连接 Notion」；Notion OAuth code（callback）；用户身份（`anonymous_id` 或 `user_id`） |
| **输出** | `notion_connections` 表写入（`access_token` 加密存储，`workspace_id`，`status='active'`）；立即跳转工作台；后台提取任务已触发 |
| **关键步骤** | 构造 Notion OAuth URL（`read_content` + `read_databases` scope）→ 跳转授权页 → Callback 路由 `/api/f2/notion/callback` → 用 code 换 `access_token`（POST Notion token endpoint）→ AES-256 加密 token 存 DB → 触发后台任务（Supabase Edge Function / Vercel Background Function）→ `302` 跳转工作台 |
| **验收标准** | ① 点「连接 Notion」跳转到 Notion 授权页面，scope 仅含 `read_content + read_databases`，不含写权限；② 授权完成后立即到达工作台，不白屏等待；③ DB 中 `access_token` 字段非明文存储（加密后不可直读）；④ 提取任务已在后台触发（`notion_connections.last_synced_at` 在 30s 内更新） |

### T-A2-3　Notion Token 有效性探测与续期管理
| 项 | 内容 |
|---|---|
| **输入** | `notion_connections.access_token`（每次同步前调用）；Notion API 响应状态码 |
| **输出** | Token 有效 → 继续同步；Token 失效（401/403）→ `status='expired'` + Realtime 推送 → 工作台黄色提示条 |
| **关键步骤** | 每次同步任务开始前：`GET https://api.notion.com/v1/users/me`（探测）→ 401/403 → 更新 `notion_connections.status='expired'` → `supabase.channel('notion_status').send(...)` 推送 → 前端侧边栏显示「⚠ Notion 需要重新授权 [重新连接]」→ 用户撤销授权：停止同步，已 confirmed 成就保留，draft 软删除；重新连接：清空旧 draft，重新拉取 |
| **验收标准** | ① 在 Notion 后台撤销授权后，下次同步触发时，工作台出现重新授权提示（≤30s）；② 重新授权后，旧 confirmed 成就不丢失；③ 重新授权后，旧 draft 成就被清空，重新生成新 draft |

### T-A2-4　后台三阶段提取任务（Supabase Edge Function）
| 项 | 内容 |
|---|---|
| **输入** | `notion_connection_id`；有效的 `access_token` |
| **输出** | `achievements` 表写入若干 `draft` 记录；Realtime 推送三个阶段进度；`notion_connections.last_synced_at` 更新 |
| **关键步骤** | **阶段1**：拉取 Notion DB 中「已完成」任务（status=Done 或 checkbox=true）→ 按 `notion_task_id` 去重（`achievements` 表已有该 task_id 的跳过）→ 一次 AI 调用批量提取成就文本（batch prompt，所有任务一次请求）→ 推送 `{stage:1, status:'done'}` → **阶段2**：5条/批并行调用 `beautifyAchievement()`（P-map 并发控制）→ 每批完成推送进度 `{stage:2, processed:N, total:M}` → **阶段3**：批量调用 `scoreAchievement()`（评分）→ 智能预选 Top6 → 写 `achievements`（`status='draft'`）→ 推送 `{stage:3, status:'done', count:N}`；120s 超时：先推送已完成的，剩余继续后台处理 |
| **验收标准** | ① 工作台进度条按阶段 1→2→3 更新，不乱序；② 阶段2 进度数字实时递增（如「美化成就(3/12)」）；③ 任务完成后左下草稿 Tab 徽章显示正确数量；④ 30 条 Notion 任务，总处理时间 ≤ 60s；100 条 ≤ 90s（P90）；⑤ 120s 超时后，已处理的成就正常展示，剩余异步补完 |

### T-A2-5　草稿审核交互（工作台左下草稿 Tab）
| 项 | 内容 |
|---|---|
| **输入** | 草稿 Tab 中的 `draft` 成就列表；用户操作（✓/✎/✗，批量）；含占位符的 tier=2 成就 |
| **输出** | DB `achievements.status` 更新；工作台简历预览实时刷新；含占位符成就确认时内联输入框弹出 |
| **关键步骤** | 「✓ 确认」：tier=1/3 直接 PATCH status=confirmed；tier=2 弹内联输入框（每个占位符一个输入域，可选填）→ 确认后 status=confirmed；「✎ 编辑」：文本变为可编辑 textarea → 保存 → confirmed；「✗ 忽略」：status=ignored；「全部确认」：批量 PATCH；「已忽略」入口：筛选 ignored 列表 → 可恢复 confirmed |
| **验收标准** | ① 批量确认 10 条，API 调用次数 ≤ 1（批量接口）；② 确认含占位符的草稿，内联输入框出现，占位符类型名称作为 placeholder 提示；③ 不填占位符直接确认，成就文本保留 `[[类型:说明]]` 原样；④ 忽略后成就从草稿 Tab 消失，进入「已忽略」列表；⑤ 从「已忽略」恢复，成就重新出现在成就库 Tab |

---

## AC-A2 · 模块整体验收标准

1. **F2 最短路径 E2E**：纯新用户从基本信息填写 → Notion 授权 → 进入工作台，全程 ≤ 3 分钟，工作台加载完成后后台提取自动运行
2. **F2 Beta 测试**：50 条真实 Notion 任务，三档美化后草稿质量人工核验，满意率 ≥ 70%
3. **Token 安全**：`notion_connections.access_token` 在 DB 层加密存储，Supabase Dashboard 直查不可读
4. **去重有效性**：同一 Notion 任务多次同步，`achievements` 表不出现重复记录（`notion_task_id` 唯一）
5. **超时降级**：模拟 200 条任务场景，120s 后用户已能看到部分成就，不出现白屏等待
