# CareerFlow 开发日志

---

## 2026-04-05 — E2E 测试通过（全流程验证）

### 端到端测试结果：✅ 29/29 PASS，0 FAIL

**页面功能（14 项）**

| 测试项 | 结果 |
|--------|------|
| Landing zh-CN 标题、上传按钮 | ✅ PASS |
| Landing en-US 标题、上传按钮 | ✅ PASS |
| 语言切换 zh→en（URL 变更） | ✅ PASS |
| Login zh/en：Google 按钮、邮箱输入、提交 | ✅ PASS |
| Pricing 三个方案卡片 + CTA 按钮 | ✅ PASS |
| Pricing zh-CN 标题（"解锁你的职业新可能"） | ✅ PASS |
| Workspace JD textarea、侧边栏、预览区、导出按钮 | ✅ PASS |
| Workspace 零 JS 控制台错误 | ✅ PASS |

**API 安全（15 项）**

| 测试项 | 预期 | 结果 |
|--------|------|------|
| `/api/resume/parse` 无 secret → 403 | 403 | ✅ PASS |
| `/api/resume/parse` 错误 secret → 403 | 403 | ✅ PASS |
| `/api/payment/webhook` 错误签名 → 401 | 401 | ✅ PASS |
| `/api/payment/webhook` 无签名 → 401 | 401 | ✅ PASS |
| `/api/resume/upload` 无文件 → 400 | 400 | ✅ PASS |
| `/api/resume/upload` 非法 MIME → 400 | 400 | ✅ PASS |
| `/api/resume/upload` 伪造 PDF magic bytes → 400 | 400 | ✅ PASS |
| `/api/resume/export` 非法格式 → 400 | 400 | ✅ PASS |
| `/api/resume/parse-status` 无参数 → 400 | 400 | ✅ PASS |
| `/api/resume/parse-status` 不存在 ID → not_found | not_found | ✅ PASS |

**注**：首轮测试中 `/api/resume/parse` 出现 30s 超时，原因是 Next.js dev server 冷启动编译。预热后立即返回 403，属正常现象，生产环境无此问题。

---

## 2026-04-05 — Phase 1+2 完成：UI 复刻 + 安全加固 + 导出修复

### 完成内容

#### UI/UX 复刻（Stitch 设计系统）
- 5 个页面按 Stitch 原型 1:1 实现：Landing、Login、Pricing、Library、Workspace
- NavBar：玻璃拟态（`bg-white/60 backdrop-blur-xl`）+ Manrope 品牌字体
- Material Design 3 色系完整映射至 Tailwind（主色 `#3525cd`，背景 `#fcf8ff`）
- i18n 中英文化适配（非直译，语境独立）— `messages/zh-CN.json` + `messages/en-US.json`

#### 安全加固（5 处关键漏洞）

| 级别 | 位置 | 问题 | 修复 |
|------|------|------|------|
| CRIT | `app/api/payment/webhook/route.ts` | 签名验证恒返回 `true`，支付可伪造 | HMAC-SHA256 + `timingSafeEqual`，依赖 `CREEM_WEBHOOK_SECRET` |
| CRIT | `app/api/resume/parse/route.ts` | 无鉴权，任意用户可触发高成本 AI 调用 | `x-internal-secret` 请求头，依赖 `INTERNAL_API_SECRET` |
| HIGH | `app/api/resume/export/route.ts` | `name = '用户'` 硬编码占位 | 从 `auth.users.user_metadata.full_name` 读取 |
| HIGH | `app/api/resume/upload/route.ts` | 仅校验 MIME 类型（客户端可伪造） | Magic byte 验证：PDF `%PDF`，DOCX `PK`，DOC `D0CF` |
| MED | `app/api/resume/export/route.ts` | 对内发 HTTP 请求触发支付流程 | 直接调用 `createCreemCheckout()` 函数 |

#### PDF/DOCX 导出修复
- **替换 jsPDF → pdf-lib**：jsPDF 是浏览器专用库，服务端（Vercel Edge/Node）无法运行
- **CJK 中文支持**：
  - 标准字体 Helvetica 仅支持 Latin（WinAnsi），中文字符抛 `cannot encode` 异常
  - 解决：打包 `public/fonts/SimHei.ttf`（9.3MB），通过 `@pdf-lib/fontkit` 嵌入
  - Vercel 部署：`readFileSync(join(process.cwd(), 'public/fonts/SimHei.ttf'))` 可正常读取
- **类型修复**：`Uint8Array<ArrayBufferLike>` → `new Blob([bytes.buffer as ArrayBuffer])`
- 实测生成：英文 PDF 2.4KB / 中文 PDF 5MB / 中英文 DOCX 各 ~8KB

#### Analytics 架构修复
- **根因**：`lib/analytics.ts` 被客户端组件 import，内部动态 `import('@/lib/supabase/server')` 依赖 `next/headers`，Webpack 打包失败
- **关键认知**：Webpack 追踪所有 `import()`（包括动态条件分支）；唯一安全做法是完全不 import server-only 模块
- **修复**：客户端用 `createBrowserClient()`，服务端用 `@supabase/supabase-js` anon key 直连

### 架构发现

- **`lib/services/*.ts` 是死代码**：`upload.ts`、`parse.ts`、`export.ts` 使用单例 Supabase 客户端（绕过 RLS），但没有任何 API 路由 import 它们。路由全部使用 `createClient()` from `lib/supabase/server` 独立实现。勿在这些文件继续开发。

### 新增必需环境变量

```bash
CREEM_WEBHOOK_SECRET=    # Webhook HMAC 验证（缺失 → 全部 401）
INTERNAL_API_SECRET=     # /api/resume/parse 内部鉴权（缺失 → 全部 403）
```

### 构建状态

```
TypeScript: 零错误
Pages: 23/23
API Routes: 全部正常
Commit: c4b69eb (main)
```

### 已知待修复（低优先级）

| ID | 位置 | 问题 |
|----|------|------|
| HIGH-05 | `app/api/resume/versions/route.ts` | 版本历史 IDOR，未验证 ownership |
| HIGH-07 | `middleware.ts` | 每次请求查数据库，应改用 JWT claims |
| LOW-07 | `components/workspace/ResumePreview.tsx` | 硬编码 "张 伟" / "example@email.com"，应接 store |

---

## 2026-03-30 — Phase 0：MVP 初始提交

- 项目脚手架：Next.js 14 App Router + next-intl + Supabase + Tailwind
- 数据库 Schema 设计（13 张表）
- AI Router 实现（p-queue + Qianwen 主 / Claude 备用）
- F1 上传流程骨架
- Prompt 外置配置（Supabase `prompt_configs` + 本地 fallback）
