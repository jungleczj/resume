<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_B3（与 PARALLEL_B1、PARALLEL_B2 并行）
================================================================
【可并行开发】
前置依赖（必须先完成）：
  · SERIAL_01 产品总览（MVP 做 GDPR，EN 市场）
  · SERIAL_02 双市场策略（GDPR 仅 EN 市场；CN 市场 Phase 1 无此要求）

可与以下模块同时并行开发：
  · PARALLEL_A1（F1 Pipeline）：文件安全路径规范（UUID 路径）由 B3 定义，
                                  A1 上传时需遵守此规范，提前对齐接口
  · PARALLEL_A2（F2 Pipeline）：Notion 最小权限要求在此明确
  · PARALLEL_B1（同屏工作台）：PII 提示条在工作台展示，内容由 B3 定义
  · PARALLEL_B2（支付与导出）：导出文件签名 URL 规范（24h 有效）

注意：
  · 第 9.4 节（Notion Token 续期）属于 F2 专属逻辑，已拆入 PARALLEL_A2
  · 文件安全规范需在 A1/A2 开始上传功能前输出接口约定文档

覆盖原文章节：第9章（9.1 文件安全 + 9.2 PII提示 + 9.3 GDPR）
================================================================
-->

# **9. 安全与合规（v5.4-v5.7 全量）**
## **9.1 文件安全**
- 简历文件路径：/uploads/{anonymousId}/{randomUUID}/resume.pdf（UUID随机，不可猜测）
- 照片文件路径：/photos/{userId or anonymousId}/{randomUUID}/photo.jpg（UUID随机）
- Storage RLS：只有文件owner（auth.uid 或 anon\_id cookie）可读写
- 上传原文件/匿名用户照片 48h后自动删除；登录用户照片永久保存
- 导出时服务端base64转换，不暴露Storage URL
- 导出文件签名URL，24h有效
## **9.2 PII 提示**
- 简历解析后正则检测手机号/身份证/地址等PII → 工作台顶部提示条（一次性可关闭）
- 不强制删除PII，仅告知AI处理过程会使用这些内容
## **9.3 GDPR（EN 市场）**
- 账号注销：软删除7天 + 硬删除级联（profiles→成就库→简历版本→照片→支付记录匿名化→Storage文件）
- 数据导出权（Article 20）：GET /api/user/export-data → ZIP（成就库.json + 简历版本.json + 照片文件）
- Notion最小权限：read\_content + read\_databases，不申请write

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-B3 · 任务清单

### T-B3-1　Supabase Storage RLS + 文件路径规范
| 项 | 内容 |
|---|---|
| **输入** | 上传简历/照片时的 `anonymous_id` Cookie 或 `auth.uid()`；Storage bucket 配置 |
| **输出** | Storage bucket 设为私有；RLS Policy 使得只有文件 owner 可读写；所有路径含随机 UUID |
| **关键步骤** | 创建两个私有 Bucket：`resumes` / `photos` → RLS Policy（`resumes`）：`auth.uid()::text = (storage.foldername(name))[1] OR current_setting('request.cookies')::json->>'anonymous_id' = (storage.foldername(name))[1]` → 同理 `photos` bucket → 所有上传路径格式：`/uploads/{id}/{randomUUID}/resume.{ext}` → 匿名用户文件 `metadata.expires_at` 写入 48h → Cron Job（每小时）扫描删除过期文件 |
| **验收标准** | ① 用 SQL 直接查询 `storage.objects`，用 userA 的 token 查询 userB 的文件，返回 0 行；② 用 curl 携带错误 `anonymous_id` 访问他人 Storage 路径，返回 403；③ 48h 后匿名文件被 Cron 删除（Storage + `uploaded_files` 表同步清理）；④ 路径中不包含任何可预测的顺序 ID（纯 UUID） |

### T-B3-2　Rate Limiting（API 请求限速）
| 项 | 内容 |
|---|---|
| **输入** | 所有 API 请求；`anonymous_id` Cookie 或 `user_id`；Redis 计数器 |
| **输出** | 超出限制返回 HTTP 429；响应头 `X-RateLimit-Remaining` / `X-RateLimit-Reset` |
| **关键步骤** | 封装 `checkRateLimit(key, limit, windowSeconds)` → 使用 Redis `INCR + EXPIRE`（滑动窗口）→ 各接口限制：上传 `10/小时/IP`；AI 生成 `20/小时/user`；未付款导出 `5/小时/user`；Webhook 不限速 → Next.js Middleware 层统一拦截 |
| **验收标准** | ① 同一 IP 上传第 11 次，返回 429，Body 含「请求过于频繁」提示；② 响应头 `X-RateLimit-Remaining` 值随调用递减；③ 窗口重置后（1小时后），计数器归零，可继续正常访问；④ Webhook 接口不受限速影响（不设 Rate Limit） |

### T-B3-3　GDPR 数据导出 `GET /api/user/export-data`
| 项 | 内容 |
|---|---|
| **输入** | 已登录用户请求（JWT 验证）；`user_id` |
| **输出** | 异步生成 ZIP 文件（`achievements.json` + `resume_versions.json` + 照片文件）；ZIP 上传 Storage；签名 URL 发邮件通知用户 |
| **关键步骤** | JWT 验证 → 写 `export_requests` 表（`status='pending'`）→ 立即返回 202「数据导出请求已收到，完成后发送邮件」→ 后台任务：查 `achievements WHERE user_id=X` → JSON stringify → 查 `resume_versions` → JSON stringify → 下载 Storage 照片文件 → `jszip` 打包 → 上传到 `exports/{userId}/{uuid}/data.zip` → `createSignedUrl(24h)` → 发邮件 |
| **验收标准** | ① 请求后立即收到 202，不白屏等待；② 邮件（< 10 分钟内）含有效下载链接；③ 下载 ZIP，解压后包含 `achievements.json`、`resume_versions.json`、`photo.jpg`（若有）；④ 链接 24h 后失效；⑤ 未登录用户调用返回 401 |

### T-B3-4　GDPR 账号注销级联删除
| 项 | 内容 |
|---|---|
| **输入** | 用户在「设置」页面点击「注销账号」→ 二次确认弹窗 → 确认 |
| **输出** | 软删除（`profiles.deleted_at = now()`）→ 立即禁止登录 → 7天后 Cron 硬删除所有关联数据 |
| **关键步骤** | `DELETE /api/user/account` → 软删除 `profiles.deleted_at` → Auth 侧 disable user → Cron（每天凌晨 2 点）：查 `profiles WHERE deleted_at < now()-7days` → 事务硬删除顺序：`achievements` → `resume_versions` → `payment_records`（匿名化，保留金额字段）→ `notion_connections` → Storage 文件（`resumes/{userId}/*` + `photos/{userId}/*`）→ `profiles`（最后）→ 发注销完成邮件 |
| **验收标准** | ① 软删除后立即尝试登录，返回「账号已注销」提示；② 软删除后 7 天内数据仍在 DB（可恢复期）；③ 模拟 Cron 执行（手动触发），DB 中该用户所有表数据清空；④ Storage 中该用户路径下文件全部删除；⑤ `payment_records` 金额字段保留（统计用），`user_id` 置 null（匿名化） |

### T-B3-5　PII 检测服务（供 A1 Pipeline 调用）
| 项 | 内容 |
|---|---|
| **输入** | 简历解析后的原始文本字符串 |
| **输出** | `{ detected: boolean, types: ('phone'｜'id_card'｜'address')[] }` |
| **关键步骤** | 封装 `detectPII(text: string)` 函数 → 正则：手机 `/1[3-9]\d{9}/g`；身份证 `/\d{17}[\dX]/gi`；地址关键词 `/(省|市|区|街道|路\d+号)/g` → 任一命中 → `detected=true` → 写 `uploaded_files.pii_detected=true` |
| **验收标准** | ① 含「13912345678」的文本，`detected=true`，`types` 含 `'phone'`；② 不含任何 PII 的文本，`detected=false`；③ 该函数为纯函数，有完整单元测试（8+ 测试用例，覆盖边界情况）；④ 执行时间 < 10ms（正则本地运行，无网络调用） |

---

## AC-B3 · 模块整体验收标准

1. **安全渗透测试**：尝试访问他人 Storage 文件、尝试伪造 Webhook 签名、尝试 SQL 注入——均返回 4xx，无数据泄露
2. **GDPR 完整流程**：注销 → 软删除生效 → 7天 Cron → 硬删除完成 → 发邮件，整个链路有自动化测试覆盖
3. **Rate Limit 压测**：ab 工具模拟 100 次/分钟上传请求，第 11 次起均返回 429，服务不崩溃
4. **PII 单元测试**：`detectPII()` 函数测试覆盖率 100%，含手机号、身份证、地址、边界情况
5. **文档输出**：向 A1、B2 模块输出接口约定文档：Storage 路径规范 + RLS 规则说明 + 签名 URL 使用方式（开发前完成）
