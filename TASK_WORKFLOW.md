# TASK_WORKFLOW.md

## 项目背景

CareerFlow MVP 开发工作流，基于 PRD v5.9 和 Tech Spec v9.0

**核心开发原则**：
- 🎨 UI/UX 设计优先（使用 Stitch MCP）
	Stitch项目为：https://stitch.withgoogle.com/projects/17366397665912095806
	项目id为17366397665912095806
	需要完全复刻已经评审通过的stitch UI
- 🗄️ 数据库 Migration 优先（自动同步到 Supabase Remote）

---

## 开发流程总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        开发流程（严格分阶段）                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 0: 项目初始化                                                    │
│  ├─ Supabase 项目 + Migration 初始化                                   │
│  ├─ 13 张数据库表创建                                                   │
│  ├─ Auth 配置                                                           │
│  └─ Supabase CLI 本地开发环境                                          │
│                                                                         │
│  Phase 1: Stitch MCP 设计 + 数据库 Migration                           │
│  ├─ Step 1: 首页 + 上传（Landing）                                     │
│  ├─ Step 2: 简历解析（Python Runtime）                                  │
│  ├─ Step 3: 同屏工作台（核心交互层）                                    │
│  ├─ Step 4: PDF/DOCX 导出 + 支付                                            │
│  ├─ Step 5: 登录 + 数据迁移                                    │
│  └─ Step 6: F2 Notion 接入                                            │
│                                                                         │
│  每一步必须：Stitch 设计 → Migration → Service → API → UI → 埋点      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0：项目初始化

### 0.1 Supabase 项目创建

```bash
# 1. 创建 Supabase 项目
# 访问 https://app.supabase.com 创建项目

# 2. 初始化本地 Supabase CLI
npx supabase init

# 3. 链接到远程项目
supabase link --project-ref vasrwebrkczkgczecpti

# 4. 目录结构
supabase/
├── config.toml          # Supabase 配置
├── migrations/          # 数据库 Migration
│   ├── 000001_initial_schema.sql
│   └── ...
└── seed/               # 种子数据
    ├── 001_paywall_settings.sql
    └── ...
```

### 0.2 初始化数据库 Migration

```bash
# 创建初始 Migration
supabase migration new initial_schema

# 编写 Migration 文件
# supabase/migrations/000001_initial_schema.sql
```

### 0.3 CI/CD Migration 自动同步

```yaml
# .github/workflows/supabase-migration.yml
name: Supabase Migration Sync

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'
      - 'supabase/seed/**'
  pull_request:
    branches: [main]

jobs:
  # 本地验证
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db validate
      - run: supabase db lint

  # 推送到 Remote
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: validate
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

## Phase 1：核心 MVP 开发

### 开发顺序规范

**每一步必须按以下顺序执行**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step N: [功能名称]                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1️⃣ Stitch MCP 设计 → 创建设计任务，生成原型，评审确认                    │
│         ↓                                                               │
│  2️⃣ Migration 编写 → 创建 migration 文件，本地验证                       │
│         ↓                                                               │
│  3️⃣ Git Push → CI/CD 自动同步 Migration 到 Supabase Remote              │
│         ↓                                                               │
│  4️⃣ Service 层开发 → 业务逻辑                                           │
│         ↓                                                               │
│  5️⃣ API Route 开发 → 接口定义                                            │
│         ↓                                                               │
│  6️⃣ 前端实现 → 基于 Stitch MCP 设计                                     │
│         ↓                                                               │
│  7️⃣ Analytics 埋点 → 事件定义                                           │
│         ↓                                                               │
│  8️⃣ 测试验证 → 功能测试                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1：首页（Landing）+ 上传

#### 1.1 Stitch MCP 设计

```bash
# 创建设计任务
stitch create-task --name "landing-page" --description "首页设计"
stitch create-task --name "upload-component" --description "简历上传组件"

# 生成原型
stitch generate --page landing --theme light --locale zh-CN,en-US
stitch generate --page upload-modal --theme light --locale zh-CN,en-US

# 评审原型
stitch review --task landing-page
stitch review --task upload-component

# 原型锁定
stitch lock --task landing-page
stitch lock --task upload-component
```

#### 1.2 数据库 Migration

```sql
-- supabase/migrations/000002_add_upload_features.sql
-- Description: Add file upload and storage features
-- Created: 2026-03-30

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('resumes', 'resumes', false),
  ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own resume"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Users can view own resume"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

-- Add resume metadata table
CREATE TABLE IF NOT EXISTS resume_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  photo_extracted TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_uploads_user_id ON resume_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_anonymous_id ON resume_uploads(anonymous_id);

COMMENT ON TABLE resume_uploads IS 'Resume file upload metadata';
COMMENT ON COLUMN resume_uploads.photo_extracted IS 'Extracted photo path if found';

-- rollback
-- DROP TABLE IF EXISTS resume_uploads;
-- DELETE FROM storage.buckets WHERE id IN ('resumes', 'photos');
-- DROP EXTENSION IF EXISTS "uuid-ossp";
```

#### 1.3 Service 层

```ts
// lib/services/upload.ts
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

export async function uploadResume(
  file: File,
  context: { userId?: string; anonymousId: string }
) {
  const { userId, anonymousId } = context
  const filePath = `uploads/${anonymousId}/${crypto.randomUUID()}/${file.name}`

  // 上传到 Storage
  const { data, error } = await supabase.storage
    .from('resumes')
    .upload(filePath, file)

  if (error) throw error

  // 保存元数据
  const { data: meta } = await supabase
    .from('resume_uploads')
    .insert({
      user_id: userId,
      anonymous_id: userId ? null : anonymousId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size
    })
    .select()
    .single()

  await trackEvent('f1_upload_started', {
    file_type: file.type,
    file_size: file.size,
    has_user: !!userId
  })

  return meta
}
```

#### 1.4 API Route

```ts
// app/api/resume/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadResume } from '@/lib/services/upload'
import { getAnonymousId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 验证文件类型和大小
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const user = await getCurrentUser(req)
    const anonymousId = await getAnonymousId(req)

    const result = await uploadResume(file, {
      userId: user?.id,
      anonymousId
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 1.5 前端页面（基于 Stitch MCP 设计）

```tsx
// 基于 Stitch MCP 原型输出
// app/[lang]/page.tsx
'use client'

import { useCallback } from 'react'
import { UploadZone } from '@/components/upload/UploadZone'
import { useUpload } from '@/hooks/useUpload'
import { trackEvent } from '@/lib/analytics'

export default function LandingPage() {
  const { upload, isUploading, progress } = useUpload()

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    await trackEvent('upload_clicked', { file_type: file.type })

    const result = await upload(file)

    // 上传成功后自动跳转工作台
    router.push(`/workspace?upload_id=${result.id}`)
  }, [upload])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Upload Zone - Stitch MCP 设计 */}
      <UploadZone
        onFilesSelected={handleUpload}
        accept=".pdf,.docx,.txt"
        maxSize={10}
        isUploading={isUploading}
        progress={progress}
      />

      {/* Features Section */}
      <FeaturesSection />
    </div>
  )
}
```

#### 1.6 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| page_view | 页面访问 | page_path, referrer |
| upload_clicked | 点击上传 | file_type |
| f1_upload_started | 上传开始 | file_type, file_size |

---

### Step 2：简历解析（Python Runtime）

#### 2.1 Stitch MCP 设计

```bash
stitch create-task --name "parsing-progress" --description "解析进度显示"
stitch generate --page parsing-status --theme light
```

#### 2.2 数据库 Migration

```sql
-- supabase/migrations/000003_add_parsing_features.sql
-- Description: Add resume parsing and AI beautification features

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Resume versions table
CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  upload_id UUID REFERENCES resume_uploads(id) ON DELETE SET NULL,
  editor_json JSONB NOT NULL,
  photo_path TEXT,
  show_photo BOOLEAN DEFAULT false,
  template_key TEXT DEFAULT 'default',
  snapshot_label TEXT,
  snapshot_jd TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_anonymous_id ON resume_versions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON resume_versions(created_at DESC);

COMMENT ON TABLE resume_versions IS 'Resume version snapshots for editing';

-- rollback
-- DROP TABLE IF EXISTS resume_versions;
```

#### 2.3 Service 层

```ts
// lib/services/parse.ts
import { supabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'

export async function parseResume(
  uploadId: string,
  context: { userId?: string; anonymousId: string; market: 'cn' | 'en' }
) {
  const startTime = Date.now()

  // 1. 获取上传文件
  const { data: upload } = await supabase
    .from('resume_uploads')
    .select('*')
    .eq('id', uploadId)
    .single()

  // 2. 解析文件内容（Python Runtime）
  const rawText = await parseFile(upload.file_path)

  // 3. 调用 AI 美化
  const prompt = await getPrompt('resume_beautify', context.market)
  const beautified = await callAI('resume_beautify', [
    { role: 'system', content: prompt },
    { role: 'user', content: rawText }
  ], context.market)

  // 4. 保存成就（默认 confirmed）
  await saveAchievements(beautified.items, context)

  // 5. 保存简历版本
  const { data: version } = await supabase
    .from('resume_versions')
    .insert({
      user_id: context.userId,
      anonymous_id: context.userId ? null : context.anonymousId,
      upload_id: uploadId,
      editor_json: beautified.tiptap_json,
      photo_path: upload.photo_extracted,
      show_photo: context.market === 'cn',
      template_key: 'default'
    })
    .select()
    .single()

  const duration = Date.now() - startTime

  await trackEvent('f1_parse_completed', {
    upload_id: uploadId,
    parse_duration_ms: duration,
    tier1_count: beautified.items.filter(i => i.tier === 1).length,
    tier2_count: beautified.items.filter(i => i.tier === 2).length,
    tier3_count: beautified.items.filter(i => i.tier === 3).length,
    has_photo: !!upload.photo_extracted
  })

  return version
}
```

#### 2.4 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| f1_parse_started | 开始解析 | upload_id |
| f1_parse_completed | 解析完成 | tier1/2/3_count, parse_duration_ms |

---

### Step 3：同屏工作台（核心交互层）

#### 3.1 Stitch MCP 设计

```bash
stitch create-task --name "workspace-layout" --description "同屏工作台布局"
stitch create-task --name "jd-panel" --description "JD输入面板"
stitch create-task --name "achievement-panel" --description "成就面板"
stitch create-task --name "resume-editor" --description "简历编辑器"

# 生成所有组件原型
stitch generate --page workspace --theme light,dark --locale zh-CN,en-US
stitch generate --page jd-panel --theme light,dark --locale zh-CN,en-US
stitch generate --page achievement-panel --theme light,dark --locale zh-CN,en-US
stitch generate --page toolbar --theme light,dark --locale zh-CN,en-US

# 评审并锁定
stitch review --task workspace-layout
stitch lock --task workspace-layout
```

#### 3.2 数据库 Migration

```sql
-- supabase/migrations/000004_add_workspace_features.sql

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  experience_id UUID REFERENCES work_experiences(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'ignored')),
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  has_placeholders BOOLEAN DEFAULT false,
  ai_score DECIMAL(3,2),
  source TEXT DEFAULT 'f1_parse',
  notion_task_id TEXT,
  original_notion_text TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_anonymous_id ON achievements(anonymous_id);

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON TABLE achievements IS 'Achievement records with AI beautification tiers';
COMMENT ON COLUMN achievements.tier IS '1: Quantified, 2: Placeholder, 3: Subjective';
COMMENT ON COLUMN achievements.embedding IS '1536-dimensional vector for semantic search';

-- rollback
-- DROP TABLE IF EXISTS achievements;
-- DROP EXTENSION IF EXISTS vector;
```

#### 3.3 工作台组件（基于 Stitch MCP 设计）

```tsx
// components/workspace/WorkspaceLayout.tsx
// 基于 Stitch MCP 原型：designs/workspace/WorkspaceLayout.tsx
'use client'

import { useState, useCallback } from 'react'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { JDPanel } from './JDPanel'
import { AchievementPanel } from './AchievementPanel'
import { ResumeEditor } from './ResumeEditor'
import { ResizeDivider } from './ResizeDivider'

export function WorkspaceLayout() {
  const [splitRatio, setSplitRatio] = useState(0.4)
  const [resumeLang, setResumeLang] = useState<'zh' | 'zh-en' | 'en'>('zh')
  const [showPhoto, setShowPhoto] = useState(true)

  const handleDrag = useCallback((delta: number) => {
    setSplitRatio(prev => Math.max(0.2, Math.min(0.8, prev + delta)))
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Stitch MCP 设计的工具栏 */}
      <WorkspaceToolbar
        resumeLang={resumeLang}
        onLangChange={setResumeLang}
        showPhoto={showPhoto}
        onPhotoToggle={() => setShowPhoto(v => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 */}
        <div className="w-[380px] flex flex-col border-r">
          {/* Stitch MCP 设计的 JD 面板 */}
          <JDPanel
            style={{ height: `${splitRatio * 100}%` }}
            onGenerate={handleGenerateResume}
          />

          {/* 可拖拽分隔线 */}
          <ResizeDivider
            onDrag={handleDrag}
            onDoubleClick={() => setSplitRatio(0.4)}
          />

          {/* Stitch MCP 设计的成就面板 */}
          <AchievementPanel
            style={{ height: `${(1 - splitRatio) * 100}%` }}
          />
        </div>

        {/* 右侧简历编辑器 */}
        <ResumeEditor
          resumeLang={resumeLang}
          showPhoto={showPhoto}
          className="flex-1"
        />
      </div>
    </div>
  )
}
```

#### 3.4 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| jd_pasted | 粘贴JD | jd_length, word_count |
| resume_generated | 生成简历 | generation_time_ms, matched_items |
| achievement_dragged | 拖拽成就 | action, from_tab, achievement_id |
| photo_toggled | 照片开关 | state, has_photo |
| language_changed | 切换语言 | new_lang |

---

### Step 4：PDF/DOCX 导出 + 支付

#### 5.1 Stitch MCP 设计

```bash
stitch create-task --name "export-modal" --description "导出支付弹窗"
stitch generate --page export-modal --theme light --locale zh-CN,en-US
```

#### 5.2 数据库 Migration

```sql
-- supabase/migrations/000006_add_payment_features.sql

-- Payment records
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  market TEXT NOT NULL,
  provider TEXT DEFAULT 'creem',
  currency TEXT DEFAULT 'USD',
  amount DECIMAL(10,2) NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('per_export', 'monthly', 'yearly')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  creem_session_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_anonymous_id ON payment_records(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);

-- Anonymous payment map
CREATE TABLE IF NOT EXISTS anonymous_payment_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_id TEXT NOT NULL,
  payment_record_id UUID REFERENCES payment_records(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending_migration' CHECK (status IN ('pending_migration', 'migrated')),
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_payment_map_anonymous_id ON anonymous_payment_map(anonymous_id);

-- rollback
-- DROP TABLE IF EXISTS anonymous_payment_map;
-- DROP TABLE IF EXISTS payment_records;
```

#### 5.3 ExportPaymentModal 组件（基于 Stitch MCP 设计）

```tsx
// components/export/ExportPaymentModal.tsx
// 基于 Stitch MCP 原型：designs/export/ExportPaymentModal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormatSelector } from './FormatSelector'
import { PlanSelector } from './PlanSelector'
import { usePaywall } from '@/hooks/usePaywall'
import { trackEvent } from '@/lib/analytics'

interface ExportPaymentModalProps {
  open: boolean
  onClose: () => void
  resumeVersionId: string
}

export function ExportPaymentModal({
  open,
  onClose,
  resumeVersionId
}: ExportPaymentModalProps) {
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf')
  const [plan, setPlan] = useState<'per_export' | 'monthly'>('per_export')
  const { prices, isLoading } = usePaywall()

  const handlePayNow = async () => {
    await trackEvent('payment_initiated', {
      plan_type: plan,
      format,
      resume_version_id: resumeVersionId
    })

    // 创建 Creem Checkout
    const { checkout_url } = await createCheckout({
      resumeVersionId,
      format,
      plan,
      market: 'en'
    })

    window.location.href = checkout_url
  }

  // CN 用户直接下载
  const handleCNExport = async () => {
    await generateAndDownload(resumeVersionId, format)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">
            {t('export.title')}
          </h2>

          {/* Stitch MCP 设计的格式选择 */}
          <FormatSelector
            value={format}
            onChange={setFormat}
          />

          {/* Stitch MCP 设计的套餐选择 */}
          {!isLoading && prices && (
            <PlanSelector
              value={plan}
              onChange={setPlan}
              prices={prices}
            />
          )}

          {/* 支付按钮 */}
          <button
            onClick={handlePayNow}
            className="w-full btn-primary"
          >
            {t('export.pay_now')} →
          </button>

          <p className="text-sm text-muted text-center">
            {t('export.secure_notice')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### 5.4 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| export_clicked | 点击导出 | has_jd, has_photo, confirmed_count |
| payment_initiated | 开始支付 | plan_type, format |
| payment_completed | 支付完成 | plan_type, amount_usd, provider |
| export_completed | 导出完成 | format, resume_lang, has_photo |

---

### Step 5：登录 + 数据迁移

#### 6.1 数据库 Migration

```sql
-- supabase/migrations/000007_add_auth_features.sql

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_market TEXT DEFAULT 'cn_free' CHECK (payment_market IN ('cn_free', 'en_paid')),
  signup_geo_country TEXT,
  resume_lang_preference TEXT DEFAULT 'zh',
  photo_path TEXT,
  photo_show_toggle BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, signup_geo_country)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'geo_country'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- rollback
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP TABLE IF EXISTS profiles;
```

#### 6.2 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| user_signup | 注册成功 | method, payment_market |
| post_payment_signup | 付款后注册 | time_after_payment_sec |
| login_completed | 登录完成 | method |

---

## 开发约束

### 禁止行为 ❌

* 不经 Stitch MCP 设计直接写代码
* 不创建 Migration 直接修改数据库
* 跳过 Migration 直接在 Supabase Dashboard 修改
* 用 geo.country 做付费判断
* 硬编码 prompt
* 前端做付费判断
* 跳过 analytics 埋点
* 在 F1 路径设置独立成就确认页

### 必须行为 ✅

* 使用 Stitch MCP 先完成 UI/UX 设计
* 使用 Migration 文件管理所有数据库变更
* CI/CD 自动同步 Migration 到 Supabase Remote
* 使用 payment_market 判断付费
* 使用 getPrompt 加载 prompt
* 使用 callAI + p-queue 调用 AI
* 在关键位置添加 analytics 埋点

---
### Step 4：F2 Notion 接入

#### 4.1 Stitch MCP 设计

```bash
stitch create-task --name "notion-onboarding" --description "Notion基本信息填写"
stitch generate --page notion-onboarding --theme light --locale zh-CN,en-US
```

#### 4.2 数据库 Migration

```sql
-- supabase/migrations/000005_add_notion_features.sql

-- Notion connections
CREATE TABLE IF NOT EXISTS notion_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_connections_user_id ON notion_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_connections_workspace_id ON notion_connections(workspace_id);

-- Notion sync jobs
CREATE TABLE IF NOT EXISTS notion_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES notion_connections(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'beautifying', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_jobs_user_id ON notion_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_jobs_status ON notion_sync_jobs(status);

-- Work experiences
CREATE TABLE IF NOT EXISTS work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  department TEXT,
  industry TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  location TEXT,
  work_type TEXT DEFAULT 'onsite',
  description TEXT,
  title_embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_experiences_user_id ON work_experiences(user_id);

-- rollback
-- DROP TABLE IF EXISTS notion_sync_jobs;
-- DROP TABLE IF EXISTS notion_connections;
-- DROP TABLE IF EXISTS work_experiences;
```

#### 4.3 Analytics 埋点

| 事件 | 触发时机 | properties |
|------|----------|------------|
| f2_notion_connect_started | 开始连接 | - |
| f2_notion_connected | 连接成功 | workspace_id |
| f2_achievements_extracted | 成就提取完成 | task_count, achievement_count |
| f2_achievement_confirmed | 成就确认 | tier, had_placeholder |

## 10 周开发排期（v9.0）

| 周 | 核心任务 | 关键交付 |
|----|----------|----------|
| W1 | 项目骨架 + Stitch MCP 设计初始化 | Migration 基础架构 / 设计系统 |
| W2 | 首页 + 上传 + 数据库 Migration | Landing 原型 / 13张表 Migration |
| W3 | 简历解析 + AI 美化 | 解析 API / beautify 函数 |
| W4 | 同屏工作台设计 + 开发 | 工作台原型评审 / 组件实现 |
| W5 | JD 匹配 + 向量化 | pgvector / JD 匹配逻辑 |
| W6 | F2 Notion 接入 | Notion OAuth / 成就提取 Pipeline |
| W7 | 文件导出 | ExportPaymentModal / PDF/DOCX 生成 |
| W8 | 支付 + 登录 | Creem 集成 / 匿名迁移 |
| W9 | 运营 + 合规 | GDPR / Admin 看板 |
| W10 | Bug Fix + Beta | 全流程回归 / 用户测试 |

---

## 最终目标

构建一个可持续扩展的 AI 产品系统

遵循：
- 🎨 UI/UX 设计优先（Stitch MCP）
- 🗄️ Migration 优先（自动同步）
- 📋 PRD v5.9 路径简化
- 🏗️ Tech Spec v9.0 架构规范
