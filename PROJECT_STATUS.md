# CareerFlow 项目实施状态

## 最后更新：2026-04-03

---

## ✅ 已完成

### Phase 0: 数据库架构
- 8个 Migration 文件（13张表）
- 3个 Seed 数据文件
- CI/CD 自动同步配置

### 核心服务层
- AI Router（p-queue + fallback）
- Prompt Loader（热更新）
- Analytics（事件追踪）
- Upload Service + API Route
- Parse Service + API Route（含文件解析实现）
- Export Service + API Route（PDF/DOCX 生成）
- Paywall Service（payment_market 驱动）
- Creem Service（支付集成框架）
- Notion Service（框架）

### API Routes
- `POST /api/resume/upload` - 上传简历，触发异步解析
- `POST /api/resume/parse` - AI 解析 + 美化 + 保存成就
- `GET /api/resume/parse-status` - 轮询解析状态
- `GET /api/resume/experiences` - 获取工作经历 + 成就
- `POST /api/resume/generate` - JD 匹配生成简历
- `POST /api/resume/export` - 导出 PDF/DOCX
- `POST /api/payment/checkout` - 创建 Creem 支付

### 前端组件
- Landing Page（首页）
- UploadZone（拖拽上传）
- WorkspaceClient（工作台主布局 + 解析进度）
- WorkspaceToolbar（工具栏）
- JDPanel（JD 输入）
- AchievementPanel（成就库）
- ResumePreview（简历预览，防复制）
- ExportModal（导出弹窗，CN 直接导出 / EN 跳转支付）

---

## ⏳ 待实现

### P0（最高优先级）
- [ ] Git 初始化 + GitHub 推送
- [ ] ResumePreview 连接真实数据（姓名 / 联系方式）
- [ ] Supabase Auth 集成（登录 / 注册）
- [ ] 照片上传（开关 + 上传 + 存储）

### P1（高优先级）
- [ ] 成就拖拽到 TipTap 编辑器
- [ ] 版本历史抽屉
- [ ] 匿名数据迁移（付款后注册）

### P2（中优先级）
- [ ] F2 Notion 接入（OAuth + 成就提取）
- [ ] Realtime 进度推送（Supabase Realtime）
- [ ] GDPR 数据删除

---

## 架构遵循状态

✅ Migration 优先（数据库变更全部通过 Migration 文件管理）
✅ payment_market 判断（不依赖 geo.country）
✅ getPrompt() 外置（Supabase 热更新 + 本地兜底）
✅ callAI() + p-queue（统一 AI 入口，限流 + fallback）
✅ trackEvent() 埋点（关键事件全部埋点）
✅ F1 路径简化（上传→直接进工作台，成就默认 confirmed，无独立确认页）
✅ 简历预览防复制（onCopy/onCut/onContextMenu 全部 preventDefault + select-none）
✅ 中英文国际化（next-intl，zh-CN / en-US）
