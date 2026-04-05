# CareerFlow Superpowers 开发进度

## 2026-04-06 Superpowers 阶段

### 本次修复和新增

#### 问题修复

1. **简历预览呈现原始上传简历信息** ✅
   - 新增 `/api/resume/upload-info` API 端点
   - 扩展 `resume_uploads` 表添加 `parsed_info` 和 `raw_text` 字段
   - 更新 `parse/route.ts` 从原始简历提取姓名、邮箱、电话、LinkedIn 等信息
   - `ResumePreview` 组件现在从 store 读取 `resumeInfo` 显示真实数据
   - 支持从 `profile` 表获取用户信息

2. **提炼进度条100%后自动消失** ✅
   - 新增独立状态 `showParsingOverlay` 控制遮罩层显示
   - 解析完成时立即设置 `setShowParsingOverlay(false)` 隐藏遮罩
   - 遮罩层添加进度条动画效果
   - 修复可能的状态同步问题

#### 新增功能

1. **简历个人信息提取器** (`lib/utils/resume-parser.ts`)
   - 从简历文本提取姓名（中英文）
   - 提取邮箱、电话号码（支持中国/美国格式）
   - 提取 LinkedIn URL
   - 提取地理位置信息
   - 提取个人网站

2. **数据库 Migration** (`20260406000001_add_resume_personal_info.sql`)
   - `resume_uploads.parsed_info` - JSONB 存储解析后的个人信息
   - `resume_uploads.raw_text` - 原始简历文本
   - `resume_uploads.parse_status` - 解析状态
   - `resume_uploads.parse_error` - 错误信息
   - 相关索引优化

3. **新 API 端点** `/api/resume/upload-info`
   - 获取最新上传简历的元信息
   - 返回 `parsedInfo` (姓名、联系方式等)
   - 返回 `rawText` (原始文本)
   - 返回 `parseStatus` (解析状态)

### 核心代码变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `lib/utils/resume-parser.ts` | 新增 | 简历个人信息提取工具 |
| `supabase/migrations/20260406000001_add_resume_personal_info.sql` | 新增 | 数据库扩展 |
| `app/api/resume/upload-info/route.ts` | 新增 | 获取简历元信息 API |
| `app/api/resume/parse/route.ts` | 修改 | 提取并保存个人信息 |
| `components/workspace/WorkspaceClient.tsx` | 修改 | 获取简历信息 + 进度条修复 |
| `store/workspace.ts` | 修改 | 已存在 resumeInfo 状态 |
| `components/workspace/ResumePreview.tsx` | 修改 | 使用真实数据显示 |

### 架构遵循检查

- ✅ Migration 优先管理数据库变更
- ✅ payment_market 驱动付费判断
- ✅ Prompt 外置 (getPrompt)
- ✅ AI 统一入口 (callAI)
- ✅ 关键行为埋点 (trackEvent)
- ✅ F1 路径极简化
- ✅ 简历预览防复制

### 待完成功能

- [ ] Supabase Auth 集成
- [ ] 照片上传功能
- [ ] 成就拖拽到 TipTap 编辑器
- [ ] 版本历史抽屉
- [ ] 匿名数据迁移
- [ ] F2 Notion 接入

### 下一步计划

1. 启动本地服务器进行测试验证
2. 实现照片上传功能
3. 实现成就拖拽交互
4. Supabase Auth 集成
