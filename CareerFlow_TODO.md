# CareerFlow MVP 功能开发 TODO 清单
> 基于 PRD v5.9 · 全量合并版 · 2026年3月
> 架构：Next.js / Supabase / Qwen / Claude / Creem / Vercel

---

## 目录
1. [基础工程搭建](#1-基础工程搭建)
2. [数据库 Schema 全表设计](#2-数据库-schema-全表设计)
3. [认证与用户系统](#3-认证与用户系统)
4. [Geo 边界与双市场策略](#4-geo-边界与双市场策略)
5. [F1：旧简历上传 Pipeline](#5-f1旧简历上传-pipeline)
6. [F2：Notion 接入 Pipeline](#6-f2notion-接入-pipeline)
7. [AI 三档美化引擎](#7-ai-三档美化引擎)
8. [成就库状态管理](#8-成就库状态管理)
9. [同屏工作台 - 布局与框架](#9-同屏工作台---布局与框架)
10. [同屏工作台 - JD粘贴与简历生成](#10-同屏工作台---jd粘贴与简历生成)
11. [同屏工作台 - 成就拖拽替换](#11-同屏工作台---成就拖拽替换)
12. [同屏工作台 - 语言切换器](#12-同屏工作台---语言切换器)
13. [同屏工作台 - 照片功能](#13-同屏工作台---照片功能)
14. [同屏工作台 - 编辑器与自动保存](#14-同屏工作台---编辑器与自动保存)
15. [同屏工作台 - 版本历史](#15-同屏工作台---版本历史)
16. [占位符系统](#16-占位符系统)
17. [导出功能](#17-导出功能)
18. [支付系统（Creem）](#18-支付系统creem)
19. [支付墙热更新](#19-支付墙热更新)
20. [选项库预置数据](#20-选项库预置数据)
21. [安全与合规](#21-安全与合规)
22. [用户分析埋点](#22-用户分析埋点)
23. [移动端适配](#23-移动端适配)
24. [AI 模型栈与降级策略](#24-ai-模型栈与降级策略)
25. [Prompt 热更新系统](#25-prompt-热更新系统)
26. [管理后台 Admin API](#26-管理后台-admin-api)
27. [邮件通知系统](#27-邮件通知系统)
28. [测试与质量保障](#28-测试与质量保障)

---

## 1. 基础工程搭建

### 1.1 项目初始化
- [ ] 使用 `create-next-app` 初始化 Next.js 14+ App Router 项目
- [ ] 配置 TypeScript（strict mode）
- [ ] 配置 ESLint + Prettier + Husky pre-commit hook
- [ ] 配置 `.env.local` / `.env.production` 环境变量结构（列出所有 key）
- [ ] 配置 Tailwind CSS + shadcn/ui 组件库

### 1.2 Supabase 接入
- [ ] 创建 Supabase 项目（staging / production 两套环境）
- [ ] 安装 `@supabase/supabase-js` + `@supabase/ssr`
- [ ] 配置 Supabase client（browser / server / middleware 三份）
- [ ] 配置 Supabase Realtime 订阅客户端
- [ ] 配置 pgvector 扩展（enable extension in Supabase Dashboard）

### 1.3 Vercel 部署配置
- [ ] 连接 GitHub 仓库，配置 Vercel 自动部署
- [ ] 配置 Vercel Edge Config（geo 相关）
- [ ] 配置 Vercel 环境变量（所有 secrets）
- [ ] 配置 Vercel Cron Jobs（订阅到期扫描等）
- [ ] 配置自定义域名 + HTTPS

### 1.4 Redis 接入（Upstash）
- [ ] 创建 Upstash Redis 实例
- [ ] 安装 `@upstash/redis`
- [ ] 封装 Redis client 工具函数（get/set/del/setNX）
- [ ] 测试连接及基础读写

### 1.5 国际化（i18n）配置
- [ ] 安装 `next-intl` 或 `next-i18next`
- [ ] 配置路由：`/zh/...` 和 `/en/...`
- [ ] 创建 `zh.json` / `en.json` 翻译文件基础结构
- [ ] 实现 middleware 自动根据 Vercel geo.country 重定向到对应语言路由

---

## 2. 数据库 Schema 全表设计

### 2.1 用户相关表
- [ ] **profiles 表**
  - `id` UUID（关联 auth.users）
  - `email` TEXT
  - `payment_market` TEXT（`cn_free` | `en_paid`）
  - `anonymous_id` TEXT（匿名用户标识）
  - `geo_country` TEXT（原始 geo，仅分析用）
  - `ui_lang` TEXT（用户手动设置的界面语言）
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ
  - `deleted_at` TIMESTAMPTZ（软删除）
  - RLS 策略：只有本人可读写

- [ ] **anonymous_payment_map 表**（匿名用户付款映射）
  - `anonymous_id` TEXT
  - `payment_intent_id` TEXT
  - `user_id` UUID（注册后填写）
  - `migrated_at` TIMESTAMPTZ

### 2.2 简历与工作经历表
- [ ] **work_experiences 表**
  - `id` UUID
  - `user_id` UUID
  - `company_name` TEXT
  - `position` TEXT
  - `start_date` DATE
  - `end_date` DATE（null = 在职）
  - `is_current` BOOLEAN
  - `sort_order` INT
  - `created_at` TIMESTAMPTZ

- [ ] **achievements 表**（核心成就库）
  - `id` UUID
  - `user_id` UUID
  - `experience_id` UUID（FK -> work_experiences）
  - `text` TEXT（三档美化后文本，含占位符）
  - `original_text` TEXT（原始文本）
  - `original_notion_text` TEXT（F2路径保留）
  - `status` TEXT（`draft` | `confirmed` | `ignored`）
  - `tier` INT（1/2/3）
  - `has_placeholders` BOOLEAN
  - `ai_score` FLOAT（0-1.0）
  - `source` TEXT（`f1_parse` | `f2_notion` | `manual`）
  - `notion_task_id` TEXT（去重用，F1为null）
  - `embedding` vector(1536)（pgvector）
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ
  - RLS 策略：只有本人可读写
  - 索引：`user_id`, `status`, `experience_id`, `embedding`（ivfflat）

- [ ] **resume_versions 表**（简历版本快照）
  - `id` UUID
  - `user_id` UUID
  - `name` TEXT（版本名称，自动命名或手动改名）
  - `content_json` JSONB（TipTap 编辑器 JSON 格式）
  - `jd_snapshot` TEXT（生成时的JD摘要，前200字）
  - `resume_lang` TEXT（`zh` | `zh_en` | `en`）
  - `has_photo` BOOLEAN
  - `trigger` TEXT（`manual` | `generated` | `pre_export`）
  - `created_at` TIMESTAMPTZ

- [ ] **education 表**
  - `id` UUID
  - `user_id` UUID
  - `school_name` TEXT
  - `major` TEXT
  - `degree` TEXT
  - `start_year` INT
  - `end_year` INT
  - `created_at` TIMESTAMPTZ

- [ ] **user_skills 表**
  - `id` UUID
  - `user_id` UUID
  - `skill_name` TEXT
  - `category` TEXT
  - `sort_order` INT

### 2.3 支付相关表
- [ ] **payment_records 表**
  - `id` UUID
  - `user_id` UUID（nullable，匿名付款时null）
  - `anonymous_id` TEXT（nullable）
  - `creem_payment_id` TEXT（唯一）
  - `plan_type` TEXT（`one_time` | `monthly` | `yearly`）
  - `amount_usd` DECIMAL
  - `status` TEXT（`pending` | `completed` | `refunded`）
  - `export_format` TEXT（`pdf` | `docx`）
  - `created_at` TIMESTAMPTZ
  - `completed_at` TIMESTAMPTZ
  - 索引：`creem_payment_id`（唯一），`user_id`

- [ ] **subscriptions 表**
  - `id` UUID
  - `user_id` UUID
  - `creem_subscription_id` TEXT
  - `plan_type` TEXT（`monthly` | `yearly`）
  - `status` TEXT（`active` | `expired` | `grace` | `cancelled`）
  - `current_period_end` TIMESTAMPTZ
  - `grace_until` TIMESTAMPTZ（宽限7天）
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ

- [ ] **paywall_settings 表**（热更新配置）
  - `id` INT（固定1行）
  - `cn_enabled` BOOLEAN（false = 完全免费）
  - `en_one_time_price` DECIMAL（默认4.99）
  - `en_monthly_price` DECIMAL（默认9.9）
  - `en_yearly_price` DECIMAL（默认79）
  - `updated_at` TIMESTAMPTZ
  - `updated_by` TEXT

### 2.4 Notion 相关表
- [ ] **notion_connections 表**
  - `id` UUID
  - `user_id` UUID
  - `workspace_id` TEXT
  - `access_token` TEXT（加密存储）
  - `status` TEXT（`active` | `expired` | `revoked`）
  - `last_synced_at` TIMESTAMPTZ
  - `created_at` TIMESTAMPTZ

### 2.5 Analytics 分析表（4张）
- [ ] **analytics_events 表**（原始事件流）
  - `id` UUID
  - `user_id` UUID（nullable）
  - `anonymous_id` TEXT
  - `event_name` TEXT
  - `properties` JSONB
  - `page_path` TEXT
  - `referrer` TEXT
  - `utm_source` / `utm_medium` / `utm_campaign` TEXT
  - `geo_country` TEXT
  - `payment_market` TEXT
  - `created_at` TIMESTAMPTZ
  - 索引：`event_name`, `created_at`, `user_id`

- [ ] **analytics_sessions 表**
  - `session_id` TEXT
  - `user_id` UUID（nullable）
  - `anonymous_id` TEXT
  - `started_at` TIMESTAMPTZ
  - `ended_at` TIMESTAMPTZ
  - `page_view_count` INT
  - `geo_country` TEXT

- [ ] **analytics_funnels 表**（漏斗快照，每日聚合）
  - `date` DATE
  - `market` TEXT（`cn` | `en`）
  - `visited` INT
  - `f1_uploaded` INT
  - `workspace_entered` INT
  - `generated` INT
  - `export_clicked` INT
  - `paid` INT
  - `registered` INT

- [ ] **analytics_revenue 表**（收入聚合）
  - `date` DATE
  - `plan_type` TEXT
  - `amount_usd` DECIMAL
  - `transaction_count` INT

### 2.6 选项库 Seed 表
- [ ] **seed_positions 表**（100个职位标签）：`id`, `name_zh`, `name_en`, `industry`
- [ ] **seed_skills 表**（300个技能标签）：`id`, `name_zh`, `name_en`, `category`
- [ ] **seed_companies 表**（国内TOP500 + Fortune500）：`id`, `name_zh`, `name_en`, `type`
- [ ] **seed_schools 表**（985/211 + QS200）：`id`, `name_zh`, `name_en`, `type`

### 2.7 文件管理表
- [ ] **uploaded_files 表**
  - `id` UUID
  - `user_id` UUID（nullable）
  - `anonymous_id` TEXT（nullable）
  - `storage_path` TEXT（`/uploads/{anon_id}/{uuid}/resume.pdf`）
  - `file_type` TEXT（`pdf` | `docx` | `txt`）
  - `file_size_bytes` INT
  - `parse_status` TEXT（`pending` | `processing` | `done` | `failed`）
  - `pii_detected` BOOLEAN
  - `created_at` TIMESTAMPTZ
  - `expires_at` TIMESTAMPTZ（匿名用户48h）

### 2.8 Prompt 配置表
- [ ] **prompt_configs 表**
  - `id` UUID
  - `name` TEXT（如 `beautify_tier1_zh`）
  - `version` INT
  - `content` TEXT（Prompt 模板，含 `{{变量}}` 占位符）
  - `model` TEXT（适用模型）
  - `active` BOOLEAN
  - `created_at` TIMESTAMPTZ

---

## 3. 认证与用户系统

### 3.1 Supabase Auth 配置
- [ ] 启用 Google OAuth provider（配置 Client ID / Secret）— 见邮箱认证引导
- [x] 启用邮箱 Magic Link 登录（signInWithOtp，login/page.tsx 已实现）
- [x] OAuth redirect URL：`/auth/callback`（app/auth/callback/route.ts 已创建）
- [ ] 配置邮件模板（确认邮件、密码重置）— 在 Supabase Dashboard 配置

### 3.2 匿名用户系统
- [ ] 生成匿名 `anonymous_id`（UUID v4）并存入 httpOnly Cookie（SameSite=Lax）
- [ ] Cookie 有效期设置（7天，滚动续期）
- [ ] 匿名用户可完整使用所有功能（上传/工作台/导出）
- [ ] 匿名用户数据关联：上传文件、成就、简历版本均通过 `anonymous_id` 关联

### 3.3 注册登录页面
- [ ] `/auth/signin` 页面：Google OAuth 按钮 + 邮箱密码表单
- [ ] `/auth/signup` 页面：邮箱注册表单（姓名/邮箱/密码）
- [ ] `/auth/callback` 路由：处理 OAuth 回调，设置 session
- [ ] 登录状态 Navbar：未登录显示「登录/注册」；已登录显示头像+下拉菜单
- [ ] 登录后 redirect 回原页面（next 参数）

### 3.4 付款后注册引导
- [ ] 支付成功后：在工作台顶部显示「注册引导卡」（非弹窗，可关闭 ✕）
- [ ] 引导卡文案：「保存成就库，下次继续使用」+ 「Google 一键注册」按钮
- [ ] 引导卡不阻断文件下载
- [ ] 引导卡关闭后不再显示（localStorage 记录）

### 3.5 匿名数据迁移
- [x] `migrateAnonymousData(anonymousId, userId)` 函数（lib/utils/migrate-anonymous-data.ts）
- [x] 迁移内容：
  - [x] `achievements` 表
  - [x] `work_experiences` 表
  - [x] `resume_versions` 表
  - [x] `resume_uploads` 表
  - [x] `payment_records` 表
  - [x] `subscriptions` 表
  - [x] `anonymous_payment_map` 表（标记 migrated_at）
- [ ] 注册成功时调用（需接入注册后回调）— 待触发
- [ ] 迁移后清除 anonymous_id Cookie — 待实现

### 3.6 账号注销（GDPR）
- [ ] `/api/user/delete` 接口：接受用户注销请求
- [ ] 软删除：`profiles.deleted_at = now()`，立即禁止登录
- [ ] 7天后硬删除 Cron Job：
  - [ ] 删除 `achievements` 记录
  - [ ] 删除 `resume_versions` 记录
  - [ ] 删除 `payment_records`（匿名化，保留金额统计）
  - [ ] 删除 Supabase Storage 中的上传文件和照片
  - [ ] 删除 `notion_connections` 记录
  - [ ] 删除 `profiles` 记录（最后执行）
- [ ] 注销成功邮件通知
- [ ] 前端：「设置」页面中「注销账号」入口 + 二次确认弹窗

---

## 4. Geo 边界与双市场策略

### 4.1 Geo 检测
- [ ] Vercel Edge Middleware：读取 `request.geo.country` 写入 `x-geo-country` header
- [ ] 根据 geo.country 判断默认语言：`CN` → `/zh`；其他 → `/en`
- [ ] 将 geo_country 写入 analytics_events（仅分析用，不参与付费逻辑）

### 4.2 payment_market 确定
- [ ] 用户首次注册时弹出「市场确认」：「你在中国大陆使用吗？」
  - 选「是」→ `payment_market = 'cn_free'`
  - 选「否」→ `payment_market = 'en_paid'`
- [ ] payment_market 写入 `profiles` 表后不随 geo 变化（防VPN绕过）
- [ ] 匿名用户：根据 geo.country 临时判断（不持久化），首次付款时确认
- [ ] `payment_market` 作为所有付费逻辑判断的唯一依据

### 4.3 CN 市场完全免费逻辑
- [ ] 检查 `paywall_settings.cn_enabled`（Redis缓存60s）
- [ ] `cn_enabled = false`：所有功能无限制，不显示任何付费相关UI
- [ ] 导出按钮：CN用户点击直接进入格式选择 → 直接下载（无付款弹窗）
- [ ] 成就库：无上限，无限AI调用

### 4.4 EN 市场付费逻辑
- [ ] 免费预览：AI美化预览可见，导出需付费
- [ ] 已订阅用户：导出直接下载（同CN体验）
- [ ] 未订阅/未付款：点导出 → 弹出支付弹窗

---

## 5. F1：旧简历上传 Pipeline

### 5.1 上传页面 UI
- [ ] 首页/上传页：大区域拖拽上传（虚线边框，支持 drag & drop）
- [ ] 点击区域打开文件选择器（仅 PDF/DOCX/TXT）
- [ ] 文件大小限制：≤10MB，超出弹出错误 Toast
- [ ] 格式校验：不支持格式弹出「仅支持 PDF / DOCX / TXT」提示
- [ ] 上传时顶部显示进度条：「AI 正在分析你的简历...」（线形进度动画）
- [ ] 进度条提示：「通常需要 10-15 秒」

### 5.2 文件上传 API
- [ ] `POST /api/f1/upload` 接口
  - [ ] 接收 multipart/form-data
  - [ ] 生成随机 UUID 路径：`/uploads/{anonymousId}/{uuid}/resume.{ext}`
  - [ ] 上传到 Supabase Storage
  - [ ] 写入 `uploaded_files` 表（`parse_status = 'pending'`）
  - [ ] 触发后台解析任务（异步，不等完成返回）
  - [ ] 返回 `{ fileId, jobId }` 给前端
- [ ] 文件安全：存储路径含随机 UUID，不可猜测

### 5.3 简历解析服务
- [ ] **PDF 解析**：使用 `pdf-parse` 或 `pdfjs-dist` 提取纯文本
- [ ] **DOCX 解析**：使用 `mammoth` 提取文本 + 基础结构
- [ ] **TXT 解析**：直接读取文本内容
- [ ] 解析后文本做基础清洗（去除多余空行、特殊字符）

### 5.4 AI 提取结构化信息
- [ ] 调用 Qwen（主）/ Claude（备）提取以下字段：
  - [ ] 姓名、联系方式（邮箱/电话）
  - [ ] 工作经历列表（公司/职位/时间/职责要点）
  - [ ] 教育背景（学校/专业/学位/时间）
  - [ ] 技能列表
  - [ ] 成就条目（从工作经历中提取）
- [ ] 使用结构化 Prompt，要求返回 JSON 格式
- [ ] 解析失败时降级：保留原始文本，进工作台显示错误提示

### 5.5 照片检测
- [ ] PDF 中检测是否嵌入人像图片（`pdfjs-dist` extractImages）
- [ ] 检测到人像图 → 提取并暂存到 Storage 临时路径
- [ ] 进入工作台后显示提示气泡：「检测到照片，是否使用？」[使用] / [忽略]
- [ ] 点「使用」→ 自动填入工作台照片区（进入裁剪流程）

### 5.6 成就自动写入
- [ ] 提取的成就条目逐条调用 `beautifyAchievement()` 函数（三档美化）
- [ ] 美化后写入 `achievements` 表，`status = 'confirmed'`（F1路径直接confirmed）
- [ ] `source = 'f1_parse'`，关联 `experience_id`

### 5.7 PII 检测
- [ ] 正则检测：手机号（中国 `1[3-9]\d{9}`）、身份证号（18位）、详细地址关键词
- [ ] 检测到 PII → 标记 `uploaded_files.pii_detected = true`
- [ ] 工作台顶部显示黄色提示条（一次性可关闭 ✕）
- [ ] 提示文案：「检测到个人敏感信息（如手机号），AI 处理过程会使用这些内容，请知悉」
- [ ] localStorage 记录已关闭状态，不再显示

### 5.8 进度推送与跳转
- [ ] 上传后立即跳转工作台（不等解析完成）
- [ ] 工作台内通过 Supabase Realtime 订阅 `uploaded_files.parse_status`
- [ ] `parse_status = 'done'` → 简历预览自动刷新，成就区显示内容
- [ ] `parse_status = 'failed'` → 显示错误 Toast + 重试按钮
- [ ] 顶部进度条：解析中显示动画；完成后消失

### 5.9 匿名用户文件 TTL
- [ ] 上传时设置 `expires_at = now() + interval '48 hours'`
- [ ] Supabase Cron Job（每小时）：删除已过期匿名文件（Storage + DB记录）

---

## 6. F2：Notion 接入 Pipeline

### 6.1 F2 入口判断
- [ ] 「连接 Notion」入口（首页 + 工作台侧边栏）
- [ ] 判断：是否有 F1 简历历史
  - 有 F1 → 直接进入 Step 1（OAuth）
  - 无 F1（纯新用户）→ 先进入 Step 0.1（基本信息填写）

### 6.2 Step 0.1 基本信息填写（纯新用户）
- [ ] **工作经历区块**
  - [ ] 公司名搜索框（接入 `seed_companies` 表，模糊搜索，支持自定义输入）
  - [ ] 职位标签多选（接入 `seed_positions` 表，100条，支持搜索 + 自定义）
  - [ ] 时间选择器：开始月份/结束月份（「至今」复选框）
  - [ ] 支持添加 1-3 条工作经历（「+添加工作经历」按钮）
  - [ ] 至少1条才能进入下一步

- [ ] **教育背景区块**（可跳过）
  - [ ] 学校搜索框（接入 `seed_schools` 表，支持自定义）
  - [ ] 专业标签选择（预置 + 自定义）
  - [ ] 学历下拉：专科/本科/硕士/博士/其他
  - [ ] 时间选择器（入学年/毕业年）
  - [ ] 「跳过」按钮（不影响后续流程）

- [ ] **技能标签区块**（推荐填写）
  - [ ] 标签云展示（接入 `seed_skills` 表，300条，按类别分组）
  - [ ] 分类：编程语言 / 框架 / 工具 / 软技能 / 语言
  - [ ] 搜索过滤框（本地过滤）
  - [ ] 点击选中/取消
  - [ ] 自定义输入（「+添加技能」）
  - [ ] 上限20个，超出禁止添加并 Toast 提示

- [ ] 填写完成 → 写入 `work_experiences` / `education` / `user_skills` 表
- [ ] → 进入 Step 1（Notion OAuth）
- [ ] 此步骤不设置语言 / 不上传照片 / 不设目标国

### 6.3 Step 1 Notion OAuth
- [ ] 点「连接 Notion」→ 跳转 Notion OAuth 授权页
- [ ] OAuth 权限范围：`read_content` + `read_databases`（最小权限，不申请 write）
- [ ] Callback 路由：`/api/f2/notion/callback`
  - [ ] 接收 `code` 参数，换取 `access_token`
  - [ ] 加密存储 `access_token` 到 `notion_connections` 表
  - [ ] 记录 `workspace_id`
  - [ ] 触发后台提取任务（异步）
  - [ ] 立即重定向到工作台

### 6.4 Notion Token 管理
- [ ] 每次同步前先验证 token 有效性（空请求探测）
- [ ] Token 失效（401/403）：
  - [ ] 更新 `notion_connections.status = 'expired'`
  - [ ] Realtime 推送给前端
  - [ ] 工作台侧边栏显示黄色提示「Notion 需要重新授权」+ 重新连接按钮
- [ ] 用户撤销授权处理：
  - [ ] 停止同步
  - [ ] 已 `confirmed` 的成就保留
  - [ ] 清除 `draft` 状态的成就（软删除）

### 6.5 Step 2 立即进入工作台
- [ ] Notion OAuth 完成后立即跳转工作台（不等待提取完成）
- [ ] 工作台左下成就区显示进度条：「🔄 正在从 Notion 提取成就... [阶段1/3]」
- [ ] 右侧简历预览：
  - 有 F1 历史 → 显示已有美化简历
  - 纯新用户 → 显示骨架屏 + AI 智能预选草稿（Top6）

### 6.6 Notion 数据提取（后台任务）
- [ ] **阶段1/3：提取**
  - [ ] 拉取 Notion 数据库中「已完成」状态的任务/条目
  - [ ] 支持的 Notion 数据库类型：任务数据库、项目数据库（配置化）
  - [ ] 按 `notion_task_id` 去重（防止重复提取）
  - [ ] AI 批量提取成就文本（一次调用，batch 处理所有条目）
  - [ ] 推送阶段进度：`{ stage: 1, status: 'extracting' }`

- [ ] **阶段2/3：美化**
  - [ ] 逐条调用 `beautifyAchievement()`（5条/批并行）
  - [ ] 写入 `tier` / `has_placeholders` 字段
  - [ ] 调用评分函数（三维度评分）
  - [ ] 实时更新进度：`{ stage: 2, processed: N, total: M }`（Realtime推送）

- [ ] **阶段3/3：完成**
  - [ ] 按 `ai_score` 降序排列，取 Top 6（每工作段至少1条）
  - [ ] 保存为 `draft` 状态写入 `achievements` 表
  - [ ] 生成 embedding 向量（替换占位符后的文本）
  - [ ] Realtime 推送完成事件到前端
  - [ ] 前端：左下草稿 Tab 显示数量徽章，简历预览自动刷新
  - [ ] 显示提示卡（非弹窗）：「✨ 发现 N 条成就草稿，点击「草稿」Tab 查看并确认」
  - [ ] 更新 `notion_connections.last_synced_at = now()`

### 6.7 超时处理
- [ ] 120s 超时判断
- [ ] 超时后：先展示已完成的成就（不阻断），剩余继续后台处理
- [ ] 显示提示：「部分成就还在处理中，稍后会自动更新」

---

## 7. AI 三档美化引擎

### 7.1 核心函数 `beautifyAchievement(text, context)`
- [ ] 输入：原始成就文本 + 上下文（职位/行业/语言）
- [ ] 输出：`{ beautifiedText, tier, hasPlaceholders, rationale }`
- [ ] F1 和 F2 使用完全相同的函数（统一标准）

### 7.2 三档判断逻辑
- [ ] **第一档（🟢 已量化）**
  - [ ] 正则检测：包含数字/百分比（`\d+%`）/金额（`¥/$/k/万`）/时间对比（月/周/天）/规模（人/条/个）
  - [ ] AI 行为：保留所有原始数字（绝不修改），调整为「强动词→做了什么→结果数据」，去口语化，≤30字
  - [ ] Prompt 明确约束：「数字是用户的真实数据，不得修改、不得生成新数字」

- [ ] **第二档（🟡 待补充）**
  - [ ] 有成果描述，但缺少具体数字，且客观上有可量化指标
  - [ ] AI 行为：识别可量化维度，插入占位符 `[[类型:说明]]`
  - [ ] 占位符示例：`[[提升幅度:如提升了多少%]]`、`[[金额:项目总预算]]`
  - [ ] 写入 `has_placeholders = true`

- [ ] **第三档（🔴 主观描述）**
  - [ ] 纯感受/态度类描述，无可量化维度
  - [ ] AI 行为：添加「建议补充具体案例」标注，保留用户原文，不强行改写

### 7.3 Prompt 配置（外置热更新）
- [ ] Prompt 存储在 `prompt_configs` DB 表（不硬编码到代码）
- [ ] 三档美化 Prompt 模板（含语言/行业变量）
- [ ] Prompt 版本管理：`version` 字段 + `active` 标记
- [ ] Admin 可修改 Prompt → Redis 失效 → 下次调用加载新版本

### 7.4 草稿评分算法（三维度）
- [ ] **维度1 量化程度（权重40%）**（本地正则，无需AI）
  - [ ] 有数字/百分比 → 0.9-1.0
  - [ ] 有成果无数字 → 0.5-0.7
  - [ ] 纯描述 → 0-0.3

- [ ] **维度2 表达完整度（权重35%）**（`qwen-turbo` 批量判断）
  - [ ] 判断三要素：强动词 + 做了什么 + 结果
  - [ ] 三要素齐全 → 高分；缺一项按比例扣分

- [ ] **维度3 职位相关性（权重25%）**（pgvector）
  - [ ] 计算成就 embedding 与工作经历职位文本 embedding 的余弦相似度
  - [ ] pgvector 查询：`1 - (achievement.embedding <=> position.embedding)`

- [ ] **综合评分**：`score = dim1*0.4 + dim2*0.35 + dim3*0.25`
- [ ] 写入 `achievements.ai_score`

### 7.5 智能预选 Top 6
- [ ] 按 `ai_score` 降序排列所有 draft 成就
- [ ] 约束：每个 work_experience 至少1条（优先保证覆盖）
- [ ] 评分 < 0.3 的工作段：显示「暂无合适成就，建议手动添加」
- [ ] Top 6 成就自动填入简历预览初始内容

---

## 8. 成就库状态管理

### 8.1 状态机
- [ ] `draft` → `confirmed`：用户点击确认
- [ ] `draft` → `ignored`：用户点击忽略
- [ ] `confirmed` → `ignored`：用户手动移除
- [ ] `ignored` → `confirmed`：从「已忽略」列表恢复
- [ ] F1 提取：直接写入 `confirmed`（跳过 draft）

### 8.2 成就操作 API
- [ ] `PATCH /api/achievements/:id/confirm`：draft → confirmed
- [ ] `PATCH /api/achievements/:id/ignore`：任意状态 → ignored
- [ ] `PATCH /api/achievements/:id/restore`：ignored → confirmed
- [ ] `PATCH /api/achievements/:id/edit`：修改 text 字段（保留 tier 标记）
- [ ] `POST /api/achievements/batch-confirm`：批量确认（接收 id 数组）
- [ ] `POST /api/achievements/batch-ignore`：批量忽略

### 8.3 成就-工作经历绑定
- [ ] 每条成就必须关联一个 `work_experience`（`experience_id` 非空）
- [ ] 左下成就区按工作段分组展示
- [ ] 手动新增成就时：必须选择关联的工作段

### 8.4 Embedding 向量管理
- [ ] 新增/更新成就时触发 embedding 计算（异步队列，不阻塞主流程）
- [ ] Embedding 源文本：将占位符 `[[类型:说明]]` 替换为 `{类型}` 后的文本
- [ ] 使用 `text-embedding-v3`（Qwen）或备用模型
- [ ] 存储到 `achievements.embedding`（vector(1536)）

### 8.5 JD 匹配降级策略
- [ ] 查询 `confirmed` 成就数量
- [ ] **≥3条**：正常 pgvector 余弦相似度匹配（阈值0.65），取 Top K
- [ ] **1-2条**：confirmed 全选 + draft 评分≥0.6 的补充，前端显示「成就较少，已补充草稿内容」
- [ ] **0条**：全用 draft Top 6，前端显示「正在使用草稿预览，确认成就后生成正式版本」

---

## 9. 同屏工作台 - 布局与框架

### 9.1 路由与页面结构
- [x] 工作台路由：`/[locale]/workspace`（或含 resumeId 参数）
- [x] 页面访问条件：有 `anonymous_id` Cookie 或登录 `user_id`（任一即可）
- [ ] SEO：`noindex`（私有页面）

### 9.2 整体布局

- [x] **左侧面板**（可调宽度）
  - [x] 左上区：JD 粘贴区（默认占左侧40%高度）
  - [ ] 可拖拽分隔线（左上/左下之间，改变上下比例）
  - [x] 左下区：成就查找替换区（默认占左侧60%高度）

- [x] **右侧顶部工具栏**
  - [x] 左侧：Logo / 品牌名（WorkspaceToolbar）
  - [x] 中间：语言切换器 | 📷照片开关
  - [ ] 「保存」按钮（存在于工具栏但未接入saveVersion）
  - [x] 右侧：「版本历史」按钮 | 「导出」按钮
- [x] **右侧面板**：简历实时预览（自定义contentEditable编辑器）
- [ ] **左右分隔线**：可拖拽调整左右宽度比例（默认35%/65%）

### 9.3 工作台初始化
- [x] 加载 `work_experiences`（左下成就区分组用）
- [x] 加载 `achievements`（confirmed + draft）
- [x] 加载最新解析数据（personal_info, education, skills）
- [ ] 订阅 Realtime（成就表、文件解析状态、Notion提取状态）
- [x] 轮询解析状态 + 进度条（parse-status API）

---

## 10. 同屏工作台 - JD粘贴与简历生成

### 10.1 JD 粘贴区 UI
- [x] 大文本框：placeholder「粘贴职位描述（JD）（可选）」
- [x] 字数实时显示：右下角「当前字数/5000」（颜色随接近上限变化）
- [x] 超5000字：自动截断 + 内联警告文字（已截断至5000字上限）
- [x] 「生成简历」按钮
  - [x] 无 JD：「生成简历（通用版）」
  - [x] 有 JD：「生成定制简历」

### 10.2 简历生成 API
- [x] `POST /api/resume/generate`
  - [x] 参数：`jd_text`（可选）、`resume_lang`、匿名/用户ID
  - [x] JD 匹配：AI 提取匹配 achievement_ids
  - [x] 成就匹配：有JD → AI相似度；无JD → 全部confirmed
  - [x] 简历组装：将匹配成就按工作段组织返回
  - [ ] 语言处理：`zh_en`/`en`全英文（AI翻译）暂未实现
  - [x] 返回结构化 JSON 格式
- [x] 生成中：按钮显示 spinner
- [x] 生成完成：直接更新预览内容
- [ ] 生成后自动触发版本快照

### 10.3 成就联动高亮
- [ ] 右侧简历点击成就行 → 左下成就区自动滚动高亮对应条目
- [ ] 左下点击成就条目 → 右侧简历滚动并高亮对应位置
- [ ] 右侧成就被直接编辑 → 左下对应条目显示「已修改」角标

---

## 11. 同屏工作台 - 成就拖拽替换

### 11.1 左下成就区 UI
- [x] Tab 切换：「成就库」Tab（confirmed）/ 「草稿」Tab（draft，带数量徽章）
- [x] 搜索框：全文检索成就内容（本地过滤）
- [x] 按工作段（work_experience）分组展示（公司名+职位标题）
- [x] 每条成就显示：档位标记（🟢/🟡/🔴 彩色小圆点）+ 文本 + 拖拽手柄（drag_indicator）
- [x] 草稿条目额外显示：✓确认 / ✗忽略 操作按钮
- [ ] ✎编辑按钮（内联编辑区）

### 11.2 桌面端拖拽（HTML5 DnD）
- [x] 成就条目设置 `draggable="true"`
- [x] `dragstart`：设置 `dataTransfer.setData('application/json', achievement)`
- [x] 简历预览每条成就行设置 `dragover` / `drop` 事件处理器

- [x] **拖入已有成就行**：
  - [x] 目标行高亮 indigo 边框+背景
  - [x] drop：替换该行成就（replaceAchievementInResume action）
  - [ ] 支持 Ctrl+Z 撤销

- [ ] **拖入空白段落/行间**：插入模式（暂未实现）
- [ ] **悬停气泡**：鼠标位置显示完整文本

### 11.3 移动端降级
- [ ] 「+ 插入」/「⇄ 替换」按钮（移动端未适配）

### 11.4 草稿审核交互
- [x] **确认（✓）**：PATCH /api/achievements/:id { status: 'confirmed' }，乐观更新
- [x] **忽略（✗）**：PATCH /api/achievements/:id { status: 'ignored' }，乐观更新
- [ ] **编辑后确认（✎）**：内联编辑区（未实现）
- [ ] 草稿 Tab 顶部：复选框全选 + 「全部确认」/「全部忽略」按钮

---

## 12. 同屏工作台 - 语言切换器

### 12.1 CN 市场语言切换器
- [x] 工具栏下拉组件：「中文」/「双语」/「English」，默认「中文」
- [x] `zh`：简历全中文
- [ ] `bilingual`：公司/职位英文，成就内容中文（生成API暂未实现差异化）
- [x] `en`：全英文（generate API 接收 resume_lang 参数）

### 12.2 EN 市场语言展示
- [ ] 固定显示「English」（非下拉，不可切换）

### 12.3 切换逻辑
- [x] 语言切换 → 自动触发简历重新生成（有confirmed成就时）
- [x] 切换过程中按钮显示 spinner（isGenerating状态）
- [x] `resume_lang` 存入 `resume_versions` 表（POST /api/resume/versions）

---

## 13. 同屏工作台 - 照片功能

### 13.1 照片开关
- [x] 工具栏「📷照片开关」Toggle 组件
- [x] 默认状态：CN 市场默认开；EN 市场默认关（profile.payment_market判断）
- [ ] 开关状态存入 localStorage（本次会话记忆）
- [x] 开→关：右侧简历预览隐藏照片区（照片文件不删除）
- [x] 关→开：恢复显示照片区（已上传照片自动显示）

### 13.2 照片上传入口
- [ ] **主入口**：简历预览区照片区域（点击 / 拖拽上传）— 未实现（显示为占位框）
- [x] **次入口**：F1 解析检测到人像图 → 自动填入 photoPath + 显示

### 13.3 照片裁剪组件
- [ ] 使用 `react-image-crop` 或 `cropperjs`（未实现）

### 13.4 照片存储
- [ ] 工作台内主动上传照片（未实现）
- [x] F1 自动提取照片路径（photo_extracted_path）已接入

### 13.5 照片在简历中的显示
- [x] 简历模板：照片固定右上角位置，2:3 比例
- [x] 开关开 + 有照片 → 简历预览显示照片
- [x] 开关关 → 不显示
- [ ] 「替换照片」按钮（未实现）

---

## 14. 同屏工作台 - 编辑器与自动保存

### 14.1 编辑器配置
- [x] 自定义 contentEditable 编辑器（替代TipTap）
  - [x] EditableCell：inline-edit with copy-block
  - [x] HighlightedEditableCell：[[type:desc]] 占位符橙色高亮
  - [x] 照片区域占位
  - [x] 教育/工作/技能区域
- [ ] TipTap 编辑器（如需结构化编辑则待迁移）

### 14.2 三层自动保存
- [x] **Layer 1（实时）**：React state（useWorkspaceStore）
- [x] **Layer 2（本地）**：
  - [x] 500ms 防抖写入 `localStorage`（key：`cf_draft_{anonymousId}`）
  - [x] 存储 resumePersonalInfo + experiences
- [x] **Layer 3（服务端）**：
  - [x] `POST /api/resume/versions` API 已实现
  - [x] `saveVersion()` store action 已实现
  - [ ] 操作暂停3s 自动触发（未接入）
  - [ ] 主动点击「保存」按钮触发（按钮未接入 saveVersion）
  - [ ] 导出前自动触发

### 14.3 崩溃恢复
- [ ] 页面重载时检测 localStorage draft 时间戳
- [ ] 顶部提示「检测到未保存的编辑，是否恢复？」

---

## 15. 同屏工作台 - 版本历史

### 15.1 版本快照触发时机
- [ ] 主动点击「保存版本」（按钮存在但未接入saveVersion）
- [ ] 每次「生成定制简历」后自动保存
- [ ] 导出前自动保存

### 15.2 版本历史抽屉 UI
- [x] 点击「版本历史」→ 从右侧滑出抽屉面板（宽400px）
- [x] 版本列表（时间倒序，按今天/昨天/本周/更早分组）
- [x] 时间戳 + 版本名称（snapshot_label）+ JD摘要
- [ ] 双击重命名版本
- [ ] 版本预览（只读对比模式）
- [x] 「恢复到该版本」→ 确认对话框 → 恢复 editor_json

### 15.3 版本管理 API
- [x] `GET /api/resume/versions`：获取版本列表（最近20条）
- [x] `POST /api/resume/versions`：创建版本快照（含 editor_json, resume_lang, show_photo）
- [ ] `GET /api/resume/versions/:id`：获取特定版本完整内容
- [ ] `PATCH /api/resume/versions/:id/rename`：重命名版本

---

## 16. 占位符系统

### 16.1 占位符格式规范
- [ ] 格式：`[[类型:说明]]`
- [ ] 解析正则：`/\[\[([^:]+):([^\]]+)\]\]/g`
- [ ] 示例：`[[提升幅度:如提升了多少%]]`

### 16.2 简历预览中占位符显示
- [ ] TipTap 自定义 Mark：占位符文本高亮橙色
- [ ] hover 显示「编辑」图标
- [ ] 点击占位符 → 内联弹出输入框（含类型提示说明）
- [ ] 输入确认后 → 替换占位符为用户输入值
- [ ] 替换后若无剩余占位符 → 更新 `has_placeholders = false`

### 16.3 待填写汇总面板
- [ ] 工作台右侧固定「待填写」面板（可折叠）
- [ ] 列出简历中所有未填占位符
- [ ] 点击某项 → 简历滚动到对应位置并聚焦输入框

### 16.4 导出前占位符提示
- [ ] 简历含未填占位符 → 点导出时：顶部非阻断提示「简历中有X处待补充数字，建议完善后导出」
- [ ] 提示不阻断导出，用户可选择忽略直接导出

---

## 17. 导出功能

### 17.1 导出 API
- [ ] `POST /api/export`
  - [ ] 参数：`format`（`pdf` | `docx`）、`resume_content_json`、`include_photo`、`photo_url`
  - [ ] 权限检查：CN → 直接生成；EN → 校验已付款/已订阅
  - [ ] 导出前自动保存版本快照
  - [ ] 加入导出队列（max 2并发）
  - [ ] 返回 `{ jobId }`，前端通过 Realtime 等待

### 17.2 PDF 生成
- [ ] 技术方案：Puppeteer / Playwright（主）→ Browserless.io（超时备用）
- [ ] 将 TipTap JSON 渲染为 HTML（使用与预览相同的 CSS）
- [ ] 照片处理：`include_photo = true` → 将照片转 base64 内嵌 HTML
- [ ] PDF 页边距/字体与简历预览模板完全一致
- [ ] 超时60s → 切换 Browserless.io → 仍失败 → 发邮件含下载链接

### 17.3 DOCX 生成
- [ ] 技术方案：`docx` npm 包
- [ ] 将 TipTap JSON 转换为 DOCX 格式（段落/样式/表格）
- [ ] 照片：`include_photo = true` → 内嵌图片到 DOCX 对应位置

### 17.4 文件命名与下载
- [ ] 命名规则：`{姓名}_{职位}_{日期}.{ext}`（如：`张三_产品经理_2026-03.pdf`）
- [ ] 生成签名下载 URL（有效期24h）
- [ ] 文件就绪后前端自动触发浏览器下载
- [ ] 工作台显示：「✅ 文件已就绪」→ 「下载」按钮

---

## 18. 支付系统（Creem）

### 18.1 Creem 集成
- [x] 配置 REST API 调用（lib/services/creem.ts）
- [x] 配置 Creem API Key 环境变量（CREEM_API_KEY）
- [x] Webhook Endpoint：`POST /api/payment/webhook`
- [x] 配置 Webhook 签名密钥（CREEM_WEBHOOK_SECRET）

### 18.2 导出支付弹窗 UI
- [x] 弹窗触发条件：EN 市场 + 未订阅
- [x] **弹窗内容**：
  - [x] 标题：「Export Resume」+ 关闭 ✕
  - [x] 格式选择：PDF / DOCX（Radio）
  - [x] 套餐选择（Radio 卡片）：单次 $4.99 / 月订阅 $9.9 / 年订阅 $79
  - [x] 「Pay Now →」主按钮
  - [x] 底部安全加密提示
- [x] 价格从 `/api/paywall-config` 实时读取（DB + fallback 默认值）
- [x] CN 免费用户：格式选择 + 直接下载（无支付）
- [x] EN 已订阅用户：格式选择 + 直接下载（check-access API 验证）

### 18.3 支付发起 API
- [x] `POST /api/payment/create-session`
  - [x] 参数：`plan_type`、`format`
  - [x] 创建 Creem Checkout Session
  - [x] 写入 `payment_records`（`status = 'pending'`）
  - [x] 返回 `checkout_url` → 前端跳转

### 18.4 Webhook 处理
- [x] `POST /api/payment/webhook`
  - [x] HMAC-SHA256 签名验证（timingSafeEqual）
  - [x] **幂等性**：DB UPDATE WHERE status='pending'（只更新一次）
  - [x] `checkout.session.completed`：更新 payment_records + 写入 subscriptions + Realtime 推送
  - [x] `subscription.deleted`：更新 status = 'cancelled'
  - [x] `subscription.updated`：更新 `current_period_end`
  - [x] `charge.refunded`：更新 status = 'refunded'

### 18.5 订阅状态机
- [x] subscriptions 表 migration（20260408000001）
- [ ] `active` → `grace`（续订失败，宽限7天）— Cron Job 待实现
- [ ] `grace` → `expired`（宽限期结束）— Cron Job 待实现
- [x] `active` → `cancelled`（用户主动取消，webhook 处理）

### 18.6 退款处理
- [x] Webhook 处理 charge.refunded 事件，降级权限
- [ ] `POST /api/payment/refund` 主动退款接口（待实现）
- [ ] 退款确认邮件（待实现）

### 18.7 订阅到期 Cron
- [ ] Vercel Cron 每天执行到期检查（待实现）

---

## 19. 支付墙热更新

### 19.1 配置读取
- [ ] `getPaywallConfig()` 函数：先查 Redis `paywall:config`（TTL 60s）→ Miss 查 DB → 写 Redis → 返回
- [ ] Redis/DB 均失败 → 返回 `paywall_defaults.ts` 静态默认值
- [ ] 前端在弹窗打开时实时调用此接口获取最新价格

### 19.2 静态兜底配置文件
- [ ] 创建 `lib/paywall_defaults.ts`：CN免费默认值 + EN 价格默认值

### 19.3 Admin 热更新 API
- [ ] `PUT /api/admin/paywall-config`（双重鉴权：x-admin-token + IP白名单）
  - [ ] 更新 `paywall_settings` 表
  - [ ] 删除 Redis key（强制失效）
  - [ ] 记录操作审计日志
  - [ ] 60s 内全站生效

---

## 20. 选项库预置数据

### 20.1 数据准备（开发前 P0）
- [ ] 整理100个职位标签（含 name_zh / name_en / industry）
- [ ] 整理300个技能标签（含分类：编程语言/框架/工具/软技能/语言）
- [ ] 整理国内TOP500 + Fortune500公司（含 name_zh / name_en）
- [ ] 整理985/211 + QS200学校（含 name_zh / name_en / type）

### 20.2 数据导入
- [ ] 编写 Supabase seed SQL 文件（`seeds/positions.sql` 等）
- [ ] 在 staging / production 执行 seed
- [ ] 配置 CI/CD 中自动执行 seed

### 20.3 前端搜索组件
- [ ] 公司/学校：防抖300ms + 服务端 `ilike %keyword%` 搜索
- [ ] 职位/技能：前端本地过滤（一次性加载）
- [ ] 所有选项支持自定义输入（「+添加 [关键词]」选项出现在结果末尾）

---

## 21. 安全与合规

### 21.1 文件安全
- [ ] 所有上传路径含随机 UUID（不可猜测）
- [ ] Supabase Storage Bucket 设为私有（RLS 强制）
- [ ] RLS 策略：`auth.uid() = user_id OR anon_id_cookie = anonymous_id`
- [ ] 导出时服务端 base64 转换（不暴露 Storage 直链）
- [ ] 导出文件：生成签名 URL（24h有效）

### 21.2 API 安全
- [ ] 所有 API 路由校验 `anonymous_id` Cookie 或 JWT Token
- [ ] Rate Limiting：上传 10次/小时/IP；AI生成 20次/小时/用户；导出 5次/小时/用户（未付款）
- [ ] CORS 配置：仅允许本域名
- [ ] 环境变量：所有 secrets 存 Vercel 环境变量，不提交代码

### 21.3 GDPR 数据导出
- [ ] `GET /api/user/export-data`（需身份验证）
  - [ ] 收集：成就库 JSON + 简历版本 JSON + 照片文件
  - [ ] 打包为 ZIP
  - [ ] 异步生成，完成后邮件通知含签名下载链接（24h有效）

### 21.4 Notion 最小权限
- [ ] OAuth 仅申请：`read_content` + `read_databases`（不申请 write）
- [ ] 授权页面展示明确的权限说明

---

## 22. 用户分析埋点

### 22.1 埋点初始化
- [ ] 封装 `track(eventName, properties)` 统一函数
- [ ] 自动附带：`anonymous_id` / `user_id` / `page_path` / `payment_market` / `geo_country`
- [ ] 写入 `analytics_events` 表（或接入 PostHog）

### 22.2 必须实现的事件埋点（全部）
- [ ] `page_view`：每次路由变化（`page_path`, `referrer`, `utm_*`）
- [ ] `user_signup`（`method`, `payment_market`）
- [ ] `f1_upload_started`（`file_type`, `file_size`）
- [ ] `f1_parse_completed`（`parse_duration_ms`, `tier1/2/3_count`）
- [ ] `jd_pasted`（`jd_length`）
- [ ] `resume_generated`（`generation_time_ms`, `matched_items`, `resume_lang`）
- [ ] `achievement_dragged`（`action: replace/insert`, `from_tab`）
- [ ] `photo_toggled`（`state: on/off`, `has_photo`）
- [ ] `photo_uploaded`（`source: auto/manual`, `market`）
- [ ] `f2_notion_connected`（`workspace_id`）
- [ ] `f2_achievements_extracted`（`task_count`, `achievement_count`, `duration_ms`）
- [ ] `f2_achievement_confirmed`（`tier`, `had_placeholder`）
- [ ] `export_clicked`（`has_jd`, `confirmed_count`, `has_photo`）
- [ ] `payment_initiated`（`plan_type`, `format`）
- [ ] `payment_completed`（`plan_type`, `amount_usd`, `provider`）
- [ ] `export_completed`（`format`, `resume_lang`, `has_photo`）
- [ ] `post_payment_signup`（`time_after_payment_sec`）
- [ ] `ai_model_fallback`（`from_model`, `to_model`, `reason`）

### 22.3 漏斗数据聚合 Cron
- [ ] 每日 Cron：从 `analytics_events` 聚合写入 `analytics_funnels` 表
- [ ] 分别按 `cn` / `en` 市场统计各步骤转化数

---

## 23. 移动端适配

### 23.1 响应式布局
- [ ] 断点：`<1024px` 为移动端
- [ ] 移动端工作台：简历预览 Tab / 成就 Tab 切换展示
- [ ] 顶部工具栏：图标化，重要功能保留
- [ ] JD 区：移动端折叠到底部抽屉

### 23.2 触摸交互
- [ ] 替换桌面拖拽为「+ 插入」/「⇄ 替换」按钮
- [ ] 照片上传：触发相机/相册选择
- [ ] 按钮触控目标高度 ≥ 44px

### 23.3 移动端提示
- [ ] 首次进入工作台（移动端）：底部 Toast「移动端可使用「插入/替换」按钮操作成就」（3s消失）

---

## 24. AI 模型栈与降级策略

### 24.1 主模型（Qwen）
- [ ] 三档美化主力：`qwen-plus`
- [ ] 结构化提取：`qwen-plus`
- [ ] 批量评分（完整度维度）：`qwen-turbo`（低成本）
- [ ] 简历生成/JD匹配：`qwen-plus`
- [ ] Embedding：`text-embedding-v3`（1536维）

### 24.2 备用模型（Claude）
- [ ] Claude Sonnet 4（高质量备用）/ Claude Haiku 4.5（低成本备用）
- [ ] 降级触发：API超时(>30s) / 错误率>50%(5分钟滑动窗口) / HTTP 5xx

### 24.3 降级实现
- [ ] 封装 `callAI(prompt, options)` 统一函数
- [ ] 内部：先调 Qwen → 失败 retry 1次 → 再失败切 Claude
- [ ] Redis 记录模型健康状态（`ai:qwen:healthy`，TTL 5分钟）
- [ ] 降级事件写入 `analytics_events`（`ai_model_fallback`）

### 24.4 成本控制
- [ ] 批量处理：三档美化 5条/批并行
- [ ] F2 Notion 提取：一次 AI 调用批量提取所有成就
- [ ] Embedding 生成：异步队列，不阻塞主流程

---

## 25. Prompt 热更新系统

### 25.1 Prompt 读取
- [ ] `getPrompt(name)` 函数：先查 Redis `prompt:{name}`（TTL 300s）→ Miss 查 `prompt_configs` 表 → 写 Redis → 返回
- [ ] 不存在 → 抛错 + fallback 本地默认 Prompt

### 25.2 Admin 更新 Prompt
- [ ] `PUT /api/admin/prompts/:name`（Admin 鉴权）
  - [ ] 插入新版本（新 `version`，设 `active = true`，旧版本 `active = false`）
  - [ ] 删除 Redis key → 下次调用自动加载新版本
  - [ ] 记录操作审计日志

---

## 26. 管理后台 Admin API

### 26.1 Admin 鉴权
- [ ] `x-admin-token` Header 固定密钥（存环境变量）
- [ ] IP 白名单检查（Vercel Edge）
- [ ] 所有操作写入 `admin_logs` 审计表

### 26.2 Admin API 清单
- [ ] `PUT /api/admin/paywall-config`：修改支付墙配置
- [ ] `PUT /api/admin/prompts/:name`：修改 Prompt
- [ ] `GET /api/admin/analytics/funnel`：漏斗数据
- [ ] `GET /api/admin/analytics/revenue`：收入数据
- [ ] `POST /api/admin/users/:id/refund`：手动触发退款

---

## 27. 邮件通知系统

### 27.1 邮件服务集成
- [ ] 接入 Resend 或 SendGrid
- [ ] 配置发件域名 + DNS（SPF/DKIM）
- [ ] 封装 `sendEmail(to, template, data)` 函数

### 27.2 邮件模板清单
- [ ] 导出文件就绪：「你的简历已生成，点击下载（24h有效）」
- [ ] 付款成功确认：订单详情 + 下载链接
- [ ] 退款成功：退款金额 + 预计到账
- [ ] 订阅到期提醒：到期时间 + 续订链接
- [ ] Notion 重新授权提醒：重连入口链接
- [ ] 账号注销确认：7天后删除提醒
- [ ] 数据导出就绪：ZIP 下载链接

---

## 28. 测试与质量保障

### 28.1 AI 三档美化质量测试
- [ ] 准备200条测试成就样本（多行业/多档位）
- [ ] 验证三档分类准确率（目标 > 85%）
- [ ] 验证「第一档不修改数字」约束（0容忍）
- [ ] 验证占位符格式正确性

### 28.2 支付链路测试
- [ ] Creem 测试环境：单次付款完整流程
- [ ] Creem 测试环境：月/年订阅完整流程
- [ ] Webhook 幂等性测试：发送重复 Webhook 验证不重复处理
- [ ] 匿名付款 → 注册 → 数据迁移完整流程测试

### 28.3 F2 Notion 提取测试
- [ ] 准备50条 Notion 任务测试集
- [ ] 验证提取准确率 + 三档美化质量
- [ ] 验证超时（120s）降级行为

### 28.4 端到端测试（E2E）
- [ ] F1 最短路径：上传 → 进工作台 → 导出（CN免费）
- [ ] F1 付费路径：上传 → 进工作台 → 导出 → 付款（EN）
- [ ] F2 完整路径：基本信息 → Notion授权 → 提取 → 确认 → 生成 → 导出
- [ ] 成就拖拽替换（桌面端）
- [ ] 成就点击替换（移动端）
- [ ] 版本历史：创建 → 查看 → 恢复
- [ ] 照片：上传 → 裁剪 → 开关控制 → 导出含照片
- [ ] 崩溃恢复：强制关闭浏览器 → 重开 → 检测草稿

### 28.5 性能目标测试
- [ ] F1 解析 + 美化：≤15s（P95）
- [ ] 简历生成（JD匹配）：≤10s（P95）
- [ ] 工作台首屏加载：≤2s（FCP）
- [ ] F2 Notion 提取100条：≤90s（P95）

### 28.6 Beta 上线检查清单
- [ ] 三档美化200条人工抽样验证 ✅
- [ ] 支付链路端到端测试 ✅
- [ ] Redis 幂等锁压测（模拟重复 Webhook）✅
- [ ] Storage RLS 权限隔离验证 ✅
- [ ] GDPR 数据导出/删除级联验证 ✅
- [ ] 移动端核心流程验证 ✅
- [ ] 错误监控（Sentry）接入 ✅
- [ ] 日志告警配置（Vercel / Supabase）✅

---

## 附：开发优先级与排期建议

| 周次 | 模块 | 关键里程碑 |
|------|------|---------|
| W1-2 | 基础工程 + DB Schema + Auth（第1-3章）| 项目跑通，登录/匿名用户可用 |
| W2-3 | F1 上传 + 解析 + 直入工作台（第5章）| F1 核心主链路跑通 |
| W3-4 | AI 三档美化引擎 + 成就库（第7-8章）| 美化功能可用，成就可写入 |
| W4-5 | 工作台布局 + TipTap + JD匹配（第9-10章）| 工作台完整可用 |
| W5-6 | 成就拖拽 + 照片 + 语言切换（第11-13章）| 工作台交互功能完整 |
| W6-7 | F2 Notion Pipeline（第6章）| F2 流程可用 |
| W7-8 | 支付系统 + 导出功能（第17-19章）| 商业化闭环 |
| W8-9 | 埋点 + 分析 + 安全合规（第21-22章）| 数据可观测，合规达标 |
| W9-10 | 测试 + Bug修复 + Beta上线（第28章）| MVP 交付 |

---

*CareerFlow_TODO.md · 基于 PRD v5.9 · 架构师版 · 全量合并 · 2026年3月*
