<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_A1（与 PARALLEL_A2 完全并行，互不依赖）
================================================================
【可并行开发】
前置依赖（必须先完成）：
  · SERIAL_01 产品总览
  · SERIAL_02 双市场策略（决定 CN/EN 导出行为差异）
  · SERIAL_03 AI三档美化引擎（F1 提取后调用 beautifyAchievement()）

可与以下模块同时并行开发：
  · PARALLEL_A2（F2 Notion Pipeline）：两条入口路径完全独立
  · PARALLEL_B3（安全合规）：文件安全/PII检测规范可同步设计
  · PARALLEL_C2（选项库数据）：seed 数据准备与 pipeline 开发无关联

本文件负责人交付物：
  · 文件上传组件（拖拽/点击）
  · 后台解析 API（PDF/DOCX/TXT → 结构化数据）
  · AI 成就提取 → 调用 beautifyAchievement() → 写入 confirmed
  · PII 检测 → 工作台顶部提示条
  · 照片人像检测与提示
  · 解析完成后自动跳转工作台（Realtime 推送）

覆盖原文章节：第3章引言段 + 第3.1节（F1主流程）
================================================================
-->

# **3. 核心用户流程（v5.9 极简化）**
v5.9 最重要的变化：上传简历后直接进入工作台（不再有「成就确认」中间页），语言选择移到工作台工具栏，照片在工作台内按需开启。F1 最短路径：上传→等15秒→进工作台→导出，4步。

## **3.1 F1 主流程（旧简历上传）**
**Step 1**  【上传】拖拽/点击上传（PDF/DOCX/TXT ≤10MB）→ 格式校验 → 立即开始后台解析

↳  顶部进度条：「AI正在分析你的简历...」（后台运行，不需要用户等在这个页面）

↳  同步完成：PII检测（若含手机号/地址等，工作台顶部提示条，一次性可关闭）

**Step 2 ★**  【直接进入工作台】解析完成即自动跳转，不经过任何中间页

↳  右侧简历预览：显示三档美化后的完整简历（🟢已量化/🟡待补充/🔴主观描述）

↳  工具栏语言选择器：CN市场默认「中文」（可切「中英双语」/「仅英文」）；EN市场默认「English」

↳  左下成就区：F1提取的成就以 confirmed 状态直接显示（无需另行确认）

↳  🟡占位符：简历预览中高亮显示，点击弹出输入框；侧边「待填写」汇总面板

**Step 3**  [可选] 粘贴JD → 点「生成定制简历」→ 右侧实时更新（≤10s）；随时从左下拖换成就

**Step 4**  【导出】点「导出」→ 弹出支付面板（见第11节）→ CN免费直接下 / EN 3步付款

↳  EN付款后：注册引导卡（非弹窗，可关闭）→ 注册 → anonymous\_id数据自动迁移

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-A1 · 任务清单

### T-A1-1　文件上传 UI 组件 `<UploadZone />`
| 项 | 内容 |
|---|---|
| **输入** | 用户拖拽或点击选择文件（PDF / DOCX / TXT，≤10MB） |
| **输出** | 选中文件后立即调用上传 API；展示进度条动画「AI 正在分析你的简历...」；上传成功后跳转 `/workspace` |
| **关键步骤** | 大区域 `dropzone`（虚线边框，拖拽高亮）→ 文件类型/大小校验（客户端）→ 不合规弹 Toast → 合规立即 `fetch POST /api/f1/upload`（FormData）→ 顶部线形进度条动画（假进度，15s 内到达 90%）→ Realtime 订阅 `uploaded_files.parse_status` → `done` 时跳转工作台 |
| **验收标准** | ① 上传 .xlsx 文件，Toast 提示「仅支持 PDF / DOCX / TXT」，不发起请求；② 上传 11MB PDF，Toast 提示「文件不能超过 10MB」；③ 合法文件上传后，顶部进度条动画立即出现；④ 模拟解析完成（`parse_status=done`），页面自动跳转 `/workspace`，不需要用户手动操作；⑤ 解析失败（`parse_status=failed`），显示错误 Toast + 「重新上传」按钮 |

### T-A1-2　文件上传 API `POST /api/f1/upload`
| 项 | 内容 |
|---|---|
| **输入** | `multipart/form-data`：`file`（二进制）；Cookie `anonymous_id` 或 JWT token |
| **输出** | `{ fileId: string, jobId: string }`（HTTP 202）；Supabase Storage 中文件已落地；`uploaded_files` 表记录已写入 |
| **关键步骤** | 服务端再次校验类型/大小 → 生成 `randomUUID()` → 上传到 Storage 路径 `/uploads/{anonymousId}/{uuid}/resume.{ext}` → 写 `uploaded_files`（`parse_status='pending'`，`expires_at=now()+48h` for 匿名）→ 异步触发解析任务（不 await）→ 立即返回 202 |
| **验收标准** | ① 响应时间 < 3s（上传 5MB PDF）；② Supabase Storage 中可见文件，路径含 UUID；③ `uploaded_files` 表中新增一行，`parse_status='pending'`；④ 用 curl 直接访问 Storage 路径返回 403（RLS 生效）；⑤ 用他人 `anonymous_id` 尝试访问，返回 403 |

### T-A1-3　简历解析服务（文本提取 + 结构化）
| 项 | 内容 |
|---|---|
| **输入** | `fileId`；从 Storage 读取的文件 Buffer |
| **输出** | `ParsedResume: { name, contacts, workExperiences[], education[], skills[], rawAchievements[] }`；写入 `work_experiences` / `education` / `user_skills` 表；更新 `uploaded_files.parse_status='processing'` |
| **关键步骤** | 从 Storage 下载文件 → 按类型解析（PDF：`pdfjs-dist`；DOCX：`mammoth`；TXT：直读）→ 文本清洗（去多余空行）→ 调用 `callAI()` 携带结构化提取 Prompt → 解析 JSON 响应 → 写 DB → 同步触发 PII 检测（T-A1-4）→ 同步触发照片检测（T-A1-5）→ 逐条调用 `beautifyAchievement()`（T-S03-2）→ 批量写入 `achievements`（`status='confirmed'`）→ 更新 `uploaded_files.parse_status='done'` → Realtime 推送 |
| **验收标准** | ① 上传标准中文简历，`work_experiences` 表中写入正确的公司名/职位/时间；② 上传英文简历，同样正确解析；③ 解析完成后 `achievements` 表有数据，所有成就 `status='confirmed'`，`source='f1_parse'`；④ 解析总耗时（含 AI 调用）P95 ≤ 15s；⑤ AI 解析失败时，`parse_status='failed'`，不抛未捕获异常 |

### T-A1-4　PII 检测与工作台提示条
| 项 | 内容 |
|---|---|
| **输入** | 解析出的文本内容 |
| **输出** | `uploaded_files.pii_detected=true/false`；工作台顶部黄色提示条（仅在 `pii_detected=true` 时显示） |
| **关键步骤** | 正则检测：手机号 `/1[3-9]\d{9}/g`、身份证 `/\d{17}[\dX]/gi`、地址关键词（省/市/区/街道）→ 命中任一 → `pii_detected=true` → 工作台读取此字段 → 渲染 Banner → localStorage key `pii_banner_closed_{fileId}` 记录关闭状态 |
| **验收标准** | ① 上传含手机号的简历，工作台顶部出现黄色 Banner；② 点击 ✕ 关闭，刷新页面后不再显示（localStorage 记录）；③ 不含 PII 的简历，工作台无 Banner；④ PII 检测不阻塞解析主流程（并行执行） |

### T-A1-5　照片人像检测与提示气泡
| 项 | 内容 |
|---|---|
| **输入** | PDF 文件 Buffer |
| **输出** | 检测到人像图 → 暂存到 Storage 临时路径 → 工作台显示气泡提示「检测到照片，是否使用？」 |
| **关键步骤** | `pdfjs-dist` 提取嵌入图片 → 判断尺寸（宽:高 ≈ 2:3，>100×150px）→ 存到 `/photos/{anonymousId}/{uuid}/detected.jpg`（临时）→ 写 `uploaded_files.detected_photo_path` → 工作台读取此字段 → 显示气泡（非弹窗）→ 点「使用」→ 进入裁剪流程（见 B1 照片模块）→ 点「忽略」→ 删除临时文件 |
| **验收标准** | ① 上传含证件照的 PDF，工作台出现照片提示气泡；② 不含照片的 PDF，无气泡；③ 点「忽略」后气泡消失，Storage 临时文件被删除；④ 照片检测失败（非 PDF 或提取报错），不影响主解析流程 |

---

## AC-A1 · 模块整体验收标准

1. **F1 最短路径 E2E**：从上传 PDF 到进入工作台，全流程 ≤ 15s（P90），用户全程无需任何等待操作
2. **成就完整性**：上传含 5 条工作经历的简历，工作台左下成就区出现 ≥ 5 条 confirmed 成就，分组展示正确
3. **文件安全**：所有上传文件路径含 UUID，Storage 直链访问 403；导出文件仅可通过签名 URL 访问
4. **匿名用户 48h 清理**：Cron Job 存在，每小时执行，过期文件被删除（DB 记录 + Storage 文件同步清理）
5. **解析失败降级**：AI 调用失败时，`parse_status='failed'`，用户看到重试入口，不显示空白工作台
