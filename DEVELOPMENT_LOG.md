# 开发日志

## 2026-04-03 开发进展

### ✅ 本次修复和新增

#### Bug 修复
- ✅ 修复上传→工作台跳转丢失 `anonymous_id` 的致命 bug（`LandingPage` + `UploadZone`）
- ✅ 修复 `/api/resume/parse` 错误处理器中二次调用 `req.json()` 的问题（body 已消耗）
- ✅ `UploadZone` 现在使用服务端返回的 `anonymous_id`（而非本地生成的）

#### 新增功能
- ✅ `/api/resume/generate` - JD 匹配生成简历端点（JDPanel 调用）
- ✅ `/api/resume/parse-status` - 轮询解析状态端点
- ✅ `/api/resume/experiences` - 刷新工作经历数据端点
- ✅ `ExportModal` 组件 - CN 直接下载 / EN 走 Creem 支付
- ✅ 工作台解析进度遮罩（AI 处理期间显示 loading 状态）
- ✅ Zustand store 增加 `setAnonymousId` / `setUserId` / `setProfile` 方法
- ✅ `WorkspaceClient` 正确初始化 store 中的身份标识

### ✅ 已完成部分（累计）

#### Phase 0: 数据库架构
- ✅ 8 个 Migration 文件（13 张表）
- ✅ 3 个 Seed 数据文件
- ✅ CI/CD 自动同步配置（`.github/workflows/supabase-migration.yml`）

#### 核心服务层
- ✅ AI Router（p-queue + fallback，千问主模型，Claude 备用）
- ✅ Prompt Loader（Supabase 热更新 + 本地兜底）
- ✅ Analytics（trackEvent）
- ✅ Upload Service + API Route（触发异步解析）
- ✅ Parse Service + API Route（文件解析 + AI 美化 + 成就保存）
- ✅ Export Service + API Route（PDF/DOCX 生成 + 付费墙）
- ✅ Paywall Service（payment_market 驱动，不依赖 geo）
- ✅ Creem Service（EN 市场支付集成）
- ✅ Notion Service（框架已建）

#### 文件处理
- ✅ PDF 解析（pdf-parse）
- ✅ DOCX 解析（mammoth）
- ✅ PDF 生成（jsPDF）
- ✅ DOCX 生成（docx.js）

#### 前端页面
- ✅ Landing Page（首页 + 上传 + Notion 入口）
- ✅ UploadZone（拖拽上传组件）
- ✅ NavBar（导航栏）
- ✅ FeatureCards（特性卡片）
- ✅ NotionConnectButton（Notion 连接按钮）
- ✅ WorkspaceClient（工作台主布局 + 解析进度遮罩）
- ✅ WorkspaceToolbar（生成 / 导出 / 版本历史 / 语言切换 / 照片开关）
- ✅ JDPanel（JD 输入 + 生成按钮 + 字数限制）
- ✅ AchievementPanel（成就库 / 草稿 Tab + 搜索 + 拖拽）
- ✅ ResumePreview（简历预览 + 防复制保护）
- ✅ ExportModal（格式选择 + CN 直接下载 / EN 跳转支付）

#### 基础设施
- ✅ next-intl 国际化（zh-CN / en-US）
- ✅ Zustand 状态管理（workspace store）
- ✅ Supabase 客户端（client + server）
- ✅ TypeScript 类型定义（domain / database / workspace）

### 🔄 待完成部分

#### 核心功能完善
- ⏳ ResumePreview 连接真实数据（姓名 / 联系方式从 profile/upload 读取）
- ⏳ 照片上传功能（拍照/上传 + Supabase Storage）
- ⏳ 版本历史抽屉（VersionHistoryDrawer）
- ⏳ 成就拖拽到简历编辑器（TipTap DnD 集成）

#### 登录和数据迁移
- ⏳ Supabase Auth 集成（Google OAuth + 邮箱）
- ⏳ 匿名数据迁移（付款后注册，数据迁移到 user_id）
- ⏳ Profile 创建触发器验证

#### F2 Notion 接入
- ⏳ Notion OAuth 流程
- ⏳ 补充信息页面（首次授权）
- ⏳ 成就提取 Pipeline（Realtime 进度推送）

#### 运营和合规
- ⏳ GDPR 数据删除
- ⏳ Admin 看板（解析/导出监控）

### 📋 下一步行动计划（P0）

1. **首次 Git 提交 + 推送 GitHub**
2. **ResumePreview 连接真实数据**（从 upload 记录读取姓名和联系方式）
3. **Supabase Auth 集成**（登录 / 注册流程）
4. **照片上传**（开关 + 上传 + 存储）

---

## 2026-04-01 开发状态回顾

### ✅ 已完成部分

#### Phase 0: 数据库架构
- ✅ 8个 Migration 文件（13张表）
- ✅ 3个 Seed 数据文件
- ✅ Supabase 项目初始化

#### 核心服务层（骨架）
- ✅ AI Router / Prompt Loader / Analytics
- ✅ Upload / Parse / Export / Paywall / Notion Service
- ✅ API Routes: `/api/resume/upload`, `/api/resume/parse`, `/api/resume/export`

#### 前端基础组件
- ✅ Landing Page / UploadZone / NavBar / FeatureCards / NotionConnectButton
- ⚠️ Workspace 组件（部分完成）

### 架构遵循检查

✅ Migration 优先
✅ payment_market 判断（不依赖 geo）
✅ getPrompt() 外置
✅ callAI() + p-queue
✅ trackEvent() 埋点
✅ F1 路径简化（上传→直接进工作台，成就默认 confirmed）
