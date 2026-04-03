# CLAUDE.md

## 项目概述

CareerFlow 是一个 AI 驱动的简历优化与职业成长工具，采用双市场策略：

* 中国市场：免费（cn_free）
* 海外市场：付费（en_paid）

---

## 核心开发原则（最高优先级）

### 🎨 原则一：UI/UX 设计优先（使用 Stitch MCP）

**所有功能开发必须遵循以下顺序**：

```
┌─────────────────────────────────────────────────────────────┐
│  1. Stitch MCP 设计 → 2. 原型评审 → 3. 数据库 Migration   │
│           ↓                                                  │
│  4. Service 层 → 5. API Route → 6. 前端实现 → 7. 埋点      │
└─────────────────────────────────────────────────────────────┘
```

**Stitch MCP 使用规范**：

1. **设计阶段**：使用 Stitch MCP 生成高保真 UI 原型
2. **评审阶段**：基于原型与产品确认交互细节
3. **锁定阶段**：原型确认后开始数据库设计和代码开发
4. **禁止**：不经过设计阶段直接写代码

**Stitch MCP 配置**：

```bash
# 初始化 Stitch MCP 项目
stitch init --project careerflow --lang zh-CN,en-US

# 生成页面原型
stitch generate --page landing --output ./designs/landing/
stitch generate --page workspace --output ./designs/workspace/
stitch generate --page export-modal --output ./designs/export/
```

---

### 🗄️ 原则二：数据库 Migration 优先（自动同步）

**Supabase Migration 工作流**：

```
┌─────────────────────────────────────────────────────────────┐
│  1. 编写 Migration 文件（本地）                               │
│           ↓                                                  │
│  2. 本地验证 → 3. Git Commit                                 │
│           ↓                                                  │
│  4. CI/CD 自动部署 → 5. Supabase Remote 自动同步             │
└─────────────────────────────────────────────────────────────┘
```

**Migration 目录结构**：

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_achievements.sql
│   ├── 003_add_analytics.sql
│   └── ...按时间戳命名
├── seed/
│   ├── 001_paywall_settings.sql
│   ├── 002_prompt_configs.sql
│   └── 003_option_libraries.sql
└── config.toml
```

**自动同步脚本**（`.github/workflows/migration.yml`）：

```yaml
name: Supabase Migration Sync

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'
      - 'supabase/seed/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

**Migration 编写规范**：

1. 每个表变更单独一个 migration 文件
2. 使用 `CREATE TABLE IF NOT EXISTS`
3. 使用 `ALTER TABLE` 而非重建表
4. 必须包含回滚语句（`-- rollback` 注释）
5. Seed 数据与 migration 分离

**示例 Migration**：

```sql
-- Migration: 001_profiles_extended.sql
-- Description: Add photo-related fields to profiles table
-- Created: 2026-03-30

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS photo_path TEXT,
ADD COLUMN IF NOT EXISTS photo_show_toggle BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS resume_lang_preference TEXT DEFAULT 'zh';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_payment_market
ON profiles(payment_market);

-- Add comment for documentation
COMMENT ON COLUMN profiles.photo_path IS 'Storage path for user photo';
COMMENT ON COLUMN profiles.photo_show_toggle IS 'Whether to show photo in resume';

-- rollback
-- ALTER TABLE profiles DROP COLUMN IF EXISTS photo_path;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS photo_show_toggle;
-- DROP INDEX IF EXISTS idx_profiles_payment_market;
```

---

### 🚀 原则三：功能开发顺序（严格遵守）

每一步必须按以下顺序执行：

```
1. Stitch MCP 设计原型（必须）
2. 原型评审通过
3. Migration 编写 + 本地测试
4. Migration 自动同步到 Supabase Remote
5. Service 层开发
6. API Route 开发
7. 前端组件实现
8. Analytics 埋点
9. 测试验证
10. 提交代码
```

---

## 关键流程

### 流程1（F1）：旧简历上传

1. 首页上传旧简历（**无需登录**），上传成功后，后台直接根据简历完成三档美化
2. 然后进入**同屏工作台**（移除独立成就确认页），显示美化效果
3. 用户可在编辑器界面选择简历生成的语言（工具栏内切换）
4. 用户还可以粘贴JD实时生成不同的定制简历
5. 满意可导出PDF或DOCX，此时视情况弹出付费墙
6. 付费成功引导用户登录，登录保存当前简历及其成就
7. 若登录，则跳转到成就库页面

### 流程2（F2）：Notion接入

1. 首页触发连接Notion授权（**需要登录**）
2. 授权前进入补充信息页面（仅用户首次授权需要）
3. 进入同屏工作台，后续步骤与流程1一致

### 同屏工作台界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 顶部工具栏：[生成简历] [导出] [版本历史] [语言▼] [📷照片] [保存]        │
│ 照片开关：CN市场默认开，EN市场默认关                                     │
├────────────────────────┬────────────────────────────────────────────────┤
│ 左上：JD粘贴区 (40%)   │ 右：简历实时预览（TipTap编辑器）                │
│ - 粘贴JD（可选）       │ ┌─────────────────────┬──────────────────┐      │
│ - ≤5000字，超长截断    │ │ 姓名/联系方式       │ 📷照片区        │      │
│ - [生成简历]按钮       │ │（照片开关开时显示）│（可上传/替换）  │      │
├──── 可拖拽分隔线 ──────┤ └─────────────────────┴──────────────────┘      │
│ 左下：成就查找替换(60%)│ 工作经历+成就条目（🟢🟡🔴）                  │
│ [成就库Tab] [草稿Tab]  │ ← 桌面：从左下拖入成就                         │
│ 🔍搜索框               │ ← 移动端：点击「插入/替换」按钮                │
└────────────────────────┴────────────────────────────────────────────────┘
```

---

## 核心架构原则（必须遵守）

### 1. Geo 与付费完全解耦（最高优先级）

* `geo.country` 不能用于付费决策
* 只能用于：默认 UI 语言

```ts
// 禁止 ❌
if (geo.country === 'CN') free()

// 正确 ✅
if (profile.payment_market === 'cn_free') free()
```

---

### 2. 唯一付费判断来源

```ts
profiles.payment_market
```

枚举值：
* `cn_free` → 免费
* `en_paid` → 付费

---

### 3. Prompt 必须外置（禁止硬编码）

```ts
const prompt = await getPrompt('resume_beautify', market)
```

优先级：
1. Supabase `prompt_configs`（热更新）
2. 本地 `config/prompts.ts`（兜底）

---

### 4. AI 模型调用规范（强制）

必须通过统一入口：

```ts
callAI(task, messages, market)
```

**模型策略**：

| 任务 | 主模型 | 备用模型 |
|------|--------|----------|
| resume_beautify | qwen-long | claude-sonnet-4-20250514 |
| jd_parse | qwen-turbo | claude-haiku-4-5-20251001 |
| achievement_extract | qwen-long | claude-sonnet-4-20250514 |
| embedding | text-embedding-v3 | text-embedding-3-small |

必须支持：
* p-queue 限流队列（concurrency: 3）
* 自动 fallback
* fallback 事件埋点

---

### 5. Analytics 埋点（强制）

```ts
trackEvent('event_name', { ...properties })
```

**关键事件**：

| 事件名 | 触发时机 | 关键 properties |
|--------|----------|-----------------|
| page_view | 页面访问 | page_path, referrer, utm_* |
| f1_upload_started | 上传简历 | file_type, file_size |
| f1_parse_completed | 进入工作台 | tier1/2/3_count |
| jd_pasted | 粘贴JD | jd_length |
| achievement_dragged | 成就拖拽 | action, from_tab |
| photo_toggled | 照片开关 | state, has_photo |
| export_clicked | 点击导出 | has_jd, has_photo |
| payment_completed | 付款成功 | plan_type, amount_usd |

---

## 数据库 Schema（13张表）

### 1. profiles
```sql
payment_market TEXT -- cn_free | en_paid
signup_geo_country TEXT
resume_lang_preference TEXT DEFAULT 'zh'
photo_path TEXT
photo_show_toggle BOOLEAN DEFAULT false
```

### 2. work_experiences
```sql
user_id / anonymous_id / company / job_title /
industry / start_year / end_year / title_embedding
```

### 3. achievements
```sql
experience_id / text / status(draft/confirmed/ignored) /
tier(1/2/3) / has_placeholders / ai_score /
source / notion_task_id / embedding
```

### 4. resume_versions
```sql
editor_json / photo_path / show_photo /
template_key / snapshot_label / snapshot_jd
```

### 5-13. 其他表
（详见 TASK_WORKFLOW.md）

---

## 技术栈规范

### Frontend
* Next.js 14（App Router）
* next-intl 3.x（国际化）
* Tailwind + shadcn/ui
* TipTap 2.x（富文本编辑器）
* Zustand 4.x（状态管理）
* TanStack Query 5.x（数据请求）
* Stitch MCP（UI/UX 设计）

### Backend
* Supabase（PostgreSQL 15 + Auth + Storage + Realtime）
* pgvector 0.7.x（向量搜索）
* Python Runtime（PDF解析）

### AI
* 通义千问 qwen-long / qwen-turbo
* Claude Sonnet 4 / Haiku 4.5
* text-embedding-v3（向量化）

### Infra
* Vercel（部署）
* Upstash Redis（限流）
* Supabase CLI（Migration 管理）

---

## 开发约束（Claude 必须遵守）

### DO ✅
* 使用 Stitch MCP 先完成 UI/UX 设计
* 使用 Migration 文件管理数据库变更
* Migration 自动同步到 Supabase Remote
* 使用统一 AI Router（callAI）
* 使用 Prompt Loader（getPrompt）
* 所有关键行为埋点（trackEvent）
* 严格区分 cn_free / en_paid
* 上传简历时无需登录（F1）
* F1 路径：上传→直接进工作台
* 坚决不允许简历预览编辑界面可复制拷贝里面的任何内容
* 中英文页面的切换需要考虑不同文化下的语境和语义

### DON'T ❌
* 不经 Stitch MCP 设计直接写代码
* 不直接修改 Supabase Remote 数据库
* 用 geo 做付费判断
* 硬编码 prompt
* 直接调用 AI SDK
* 前端做付费判断
* 跳过 analytics
* 硬编码付费墙开关、价格、提供商等
* 在 F1 路径设置独立成就确认页
* 在上传前设置语言/照片
* 简历预览编辑可复制拷贝里面的任何内容
* 中英文页面简单直译


---

## 总结（核心原则）

1. **UI/UX 设计优先**：使用 Stitch MCP 先完成设计原型
2. **Migration 优先**：所有数据库变更通过 Migration 文件管理
3. **自动同步**：CI/CD 自动将 Migration 同步到 Supabase Remote
4. **付费只看 payment_market**
5. **Prompt 必须外置**
6. **AI 必须走统一 Router**
7. **F1 上传无需登录，直接进工作台**
8. **语言选择移入工作台工具栏**
9. **照片极简（仅开关+上传）**
10. **支付路径≤3步**
11. **简历可预览可编辑，但决不能允许拷贝出来，技术上需要完全杜绝，即使使用前端任何技术都无法修改这个设定**
12.**中英文页面不能简单直译，需要考虑不同文化下的语境和语义**

违反任一条 = 架构错误
