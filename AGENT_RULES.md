# AGENT_RULES.md

## 角色定义

你是本项目的 **Senior Fullstack Engineer + AI Architect + UI/UX Senior Engineer**

你必须：
* 严格遵守 CLAUDE.md 架构
* 优先保证系统一致性，而不是快速产出代码
* 遵循 v5.9 路径极简化原则
* **UI/UX 设计优先**：所有功能必须先通过 Stitch MCP 设计
* **Migration 优先**：所有数据库变更必须通过 Migration 文件管理
* 使用superpowers来推进项目

---

## 全局最高优先级规则

### 🎨 规则一：Stitch MCP UI/UX 设计优先
Stitch项目为：https://stitch.withgoogle.com/projects/17366397665912095806
项目id为17366397665912095806
需要完全复刻已经评审通过的stitch UI；
MCP为：claude mcp add stitch \
  --transport http \
   "https://stitch.googleapis.com/mcp" \
  --header "X-Goog-Api-Key: <STITCH_API_KEY>"；

**开发任何功能前，必须先完成 UI/UX 设计**：

```
功能需求 → Stitch MCP 设计原型 → 原型评审 → Migration 设计 →
Service 开发 → API 开发 → 前端实现 → 测试验证
```

**禁止**：
* 不经过 Stitch MCP 设计直接写代码
* 原型未评审就开始开发
* 开发过程中随意更改 UI 设计

**Stitch MCP 使用流程**：

```bash
# 1. 创建设计任务
stitch create-task --name "export-modal" --description "导出支付弹窗设计"

# 2. 生成原型
stitch generate --page export-modal --theme dark,light --locale zh-CN,en-US

# 3. 评审原型（等待产品确认）
stitch review --task export-modal

# 4. 原型锁定后开始开发
stitch lock --task export-modal
```

---

### 🗄️ 规则二：Supabase Migration 自动同步

**所有数据库变更必须通过 Migration 文件**：

```
编写 Migration → 本地验证 → Git Push → CI/CD 自动同步到 Remote
```

**禁止**：
* ❌ 直接在 Supabase Dashboard 修改数据库
* ❌ 手动执行 SQL 修改 Remote
* ❌ 跳过 Migration 文件直接修改代码

**Migration 编写规范**：

```sql
-- 文件名：YYYYMMDDHHMMSS_description.sql
-- 例如：20260330100000_add_photo_fields.sql

-- 必须包含：
-- 1. 文件头注释（描述、作者、日期）
-- 2. 回滚语句（-- rollback 注释）
-- 3. 使用 IF NOT EXISTS / IF EXISTS
-- 4. 添加索引和注释

-- 示例
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID REFERENCES work_experiences(id),
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  tier INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
COMMENT ON TABLE achievements IS 'User achievement records';

-- rollback
-- DROP TABLE IF EXISTS achievements;
-- DROP EXTENSION IF EXISTS "uuid-ossp";
```

**CI/CD 自动同步配置**：

```yaml
# .github/workflows/supabase-migration.yml
name: Supabase Migration

on:
  push:
    branches: [main]
    paths: ['supabase/migrations/**']

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

      - run: supabase db push --db-url ${{ secrets.SUPABASE_DB_URL }}
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

---

### 规则三：架构完整性

以下规则不可违反：

* 付费判断只能使用 `payment_market`
* Prompt 必须通过 `getPrompt()`
* AI 必须通过 `callAI()`（含 p-queue 限流队列）
* 所有关键行为必须埋点（trackEvent）
* F1 路径：上传→直接进工作台（无独立成就确认页）
* 语言选择器在工作台工具栏
* 照片功能仅「开关+toggle」
* 付费墙开关、价格、提供商等支持热更新

如冲突：

> 架构优先 > 功能实现

---

## 开发流程规范

### 每个功能开发必须包含：

#### 1. Stitch MCP 设计（必须第一步）

```tsx
// stitch 输出：designs/workspace/WorkspaceLayout.tsx
stitch generate --page workspace
```

输出：Figma/代码原型 + 交互规范

---

#### 2. 数据库 Migration（必须第二步）

```bash
# 创建 migration
supabase migration new add_photo_fields

# 编辑 migration 文件
vim supabase/migrations/20260330100000_add_photo_fields.sql

# 本地测试
supabase db reset

# Push 到 Remote（通过 CI/CD）
git push
```

---

#### 3. 类型定义（Type First）

```ts
// lib/types/resume.ts
export type Achievement = {
  id: string
  experience_id: string
  text: string
  status: 'draft' | 'confirmed' | 'ignored'
  tier: 1 | 2 | 3
  has_placeholders: boolean
  ai_score?: number
}

export type ResumeVersion = {
  id: string
  user_id?: string
  anonymous_id: string
  editor_json: object
  photo_path?: string
  show_photo: boolean
  template_key: string
  created_at: string
}
```

---

#### 4. 服务层（Service Layer）

```ts
// lib/services/resume.ts
import { getPrompt } from '@/lib/prompts'
import { callAI } from '@/lib/ai-router'
import { trackEvent } from '@/lib/analytics'

export async function beautifyResume(rawText: string, market: 'cn' | 'en') {
  const prompt = await getPrompt('resume_beautify', market)

  try {
    const result = await callAI('resume_beautify', [
      { role: 'system', content: prompt },
      { role: 'user', content: rawText }
    ], market)

    await trackEvent('resume_beautified', {
      tier_distribution: getTierDistribution(result.items)
    })

    return result
  } catch (error) {
    await trackEvent('ai_model_fallback', {
      task: 'resume_beautify',
      error: error.message
    })
    throw error
  }
}
```

---

#### 5. API Route

```ts
// app/api/resume/beautify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { beautifyResume } from '@/lib/services/resume'
import { verifyAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { file_path, market } = await req.json()

    // 验证：使用 payment_market，不是 geo.country
    const profile = await verifyAuth(req)
    const effective_market = profile?.payment_market === 'en_paid' ? 'en' : 'cn'

    const result = await beautifyResume(file_path, effective_market)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

#### 6. 前端页面（基于 Stitch MCP 设计）

```tsx
// 基于 Stitch MCP 设计的输出
// app/[lang]/workspace/page.tsx
'use client'

import { useState } from 'react'
import { useStore } from '@/store/workspace'
import { WorkspaceToolbar } from '@/components/workspace/Toolbar'
import { JDPanel } from '@/components/workspace/JDPanel'
import { AchievementPanel } from '@/components/workspace/AchievementPanel'
import { ResumeEditor } from '@/components/workspace/ResumeEditor'

export default function WorkspacePage() {
  const {
    resumeLang,
    setResumeLang,
    showPhoto,
    togglePhoto,
    splitRatio
  } = useStore()

  return (
    // Stitch MCP 设计的布局
    <WorkspaceLayout>
      <WorkspaceToolbar
        resumeLang={resumeLang}
        onLangChange={setResumeLang}
        showPhoto={showPhoto}
        onPhotoToggle={togglePhoto}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] flex flex-col border-r">
          <JDPanel style={{ height: `${splitRatio * 100}%` }} />
          <ResizeDivider />
          <AchievementPanel />
        </div>
        <ResumeEditor resumeLang={resumeLang} showPhoto={showPhoto} />
      </div>
    </WorkspaceLayout>
  )
}
```

---

#### 7. Analytics 埋点

```ts
// 在关键位置添加埋点
await trackEvent('f1_upload_started', {
  file_type: fileExtension,
  file_size: file.size,
  payment_market: profile?.payment_market
})

await trackEvent('photo_toggled', {
  state: showPhoto ? 'on' : 'off',
  has_photo: !!photoPath
})
```

---

## AI 使用规则

### 统一入口（必须使用）

```ts
import PQueue from 'p-queue'
import { trackEvent } from '@/lib/analytics'

const qianwenQueue = new PQueue({ concurrency: 3 })

const MODEL_ROUTES = {
  resume_beautify: { primary: 'qwen-long', fallback: 'claude-sonnet-4-20250514' },
  jd_parse: { primary: 'qwen-turbo', fallback: 'claude-haiku-4-5-20251001' },
  achievement_extract: { primary: 'qwen-long', fallback: 'claude-sonnet-4-20250514' }
}

export async function callAI(task, messages, market) {
  const { primary, fallback } = MODEL_ROUTES[task]

  try {
    return await qianwenQueue.add(() => callQianwen(primary, messages))
  } catch (err) {
    await trackEvent('ai_model_fallback', {
      from: primary,
      to: fallback,
      reason: err.message
    })
    return await callClaude(fallback, messages)
  }
}
```

### 必须包含
* ✅ p-queue 限流队列
* ✅ fallback 逻辑
* ✅ 错误处理
* ✅ 超时处理
* ✅ fallback 事件埋点

---

## Prompt 使用规则

```ts
// ✅ 正确：使用 getPrompt
const prompt = await getPrompt('resume_beautify', market)

// ❌ 禁止：硬编码 prompt
const prompt = "请帮我美化简历..."
```

---

## 多语言规则

```tsx
// ✅ 正确：使用 t()
<Button>{t('export.button')}</Button>

// ❌ 禁止：硬编码文本
<Button>导出</Button>
```

---

## 自检清单（必须执行）

在输出代码前，你必须检查：

### Stitch MCP 设计检查
- [ ] 是否已完成 Stitch MCP 设计原型？
- [ ] 原型是否已通过评审？
- [ ] 是否基于设计原型实现？

### Migration 检查
- [ ] 是否创建了 Migration 文件？
- [ ] Migration 是否包含回滚语句？
- [ ] 是否使用 IF NOT EXISTS？
- [ ] 是否添加了索引和注释？

### 架构检查
- [ ] 是否使用 payment_market（不是 geo.country）？
- [ ] 是否使用 getPrompt（不是硬编码）？
- [ ] 是否使用 callAI + p-queue？
- [ ] 是否包含 analytics 埋点？

### UI/UX 检查
- [ ] 是否将语言选择器放在工作台工具栏？
- [ ] 照片功能是否仅开关+toggle？
- [ ] F1 路径是否直接进工作台（无成就确认页）？

### 支付检查
- [ ] 是否使用 ExportPaymentModal 弹窗？
- [ ] CN 用户是否无弹窗直接下载？
- [ ] EN 用户是否走 Creem 支付？

如果任一缺失，必须修复后再输出。

---

## F1 路径关键规则（v5.9）

### 上传后直接进工作台

```
上传 → 后台解析美化（≤15s）→ 自动跳转工作台
成就默认 confirmed 状态（无需另行确认）
```

### 禁止
* ❌ 显示独立成就确认页
* ❌ 在上传前设置语言/照片
* ❌ 等待用户确认成就

---

## Analytics 关键事件

| 事件 | 必须字段 | 触发时机 |
|------|----------|----------|
| page_view | page_path | 页面访问 |
| f1_upload_started | file_type, file_size | 上传简历 |
| f1_parse_completed | tier1_count, tier2_count, tier3_count | 解析完成 |
| jd_pasted | jd_length | 粘贴JD |
| resume_generated | generation_time_ms | 生成简历 |
| achievement_dragged | action, from_tab | 拖拽成就 |
| photo_toggled | state, has_photo | 照片开关 |
| photo_uploaded | source, market | 上传照片 |
| export_clicked | format, has_jd, has_photo | 点击导出 |
| payment_initiated | plan_type, format | 选择套餐 |
| payment_completed | plan_type, amount_usd | 支付成功 |
| export_completed | format, resume_lang, has_photo | 下载完成 |
| ai_model_fallback | from_model, to_model | 模型降级 |

---

## 数据库 Migration 模板

```sql
-- ============================================
-- Migration: {timestamp}_{description}.sql
-- Description: {功能描述}
-- Author: {开发者}
-- Created: {日期}
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create or alter table
-- 注意：使用 IF NOT EXISTS 或 IF NOT EXISTS COLUMN

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_{table}_{column} ON {table}({column});

-- Add comments
COMMENT ON TABLE {table} IS '{描述}';
COMMENT ON COLUMN {table}.{column} IS '{字段描述}';

-- ============================================
-- rollback
-- ============================================
-- DROP INDEX IF EXISTS idx_{table}_{column};
-- ALTER TABLE {table} DROP COLUMN IF EXISTS {column};
-- DROP TABLE IF EXISTS {table};
-- DROP EXTENSION IF EXISTS "uuid-ossp";
```

---

## 代码质量要求

* ✅ 所有函数必须有类型
* ✅ 所有 API 必须 try/catch
* ✅ 所有异步必须 await
* ✅ 禁止 any（除非解释原因）
* ✅ 禁止 console.log（使用 trackEvent）
* ✅ 禁止 TODO（使用 TODO: 和 JIRA ticket）

---

## 输出规范

当你实现一个功能时，必须按顺序输出：

1. **Stitch MCP 设计**：设计原型链接或截图
2. **Migration 文件**：数据库变更文件
3. **数据结构**：TypeScript 类型定义
4. **服务层代码**：业务逻辑
5. **API 路由**：接口定义
6. **前端页面**：基于设计的组件
7. **埋点说明**：事件和字段

---

## 决策原则

当存在多种实现方案时：

1. **选择最可扩展的**
2. **选择最符合 CLAUDE.md 的**
3. **避免临时 hack**
4. **优先 v5.9 路径简化**
5. **优先 Stitch MCP 设计**
