<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：SERIAL_03（串行第3步，F1/F2 两条 Pipeline 的共同核心依赖）
================================================================
【串行 / 前置依赖：SERIAL_01、SERIAL_02】
本文件定义 F1 和 F2 共用的 AI 美化引擎与成就库数据模型，
是以下模块开发的强依赖前置：
  · PARALLEL_A1（F1 Pipeline）：使用 beautifyAchievement()
  · PARALLEL_A2（F2 Pipeline）：使用相同函数 + 评分算法
  · PARALLEL_B1（工作台）：成就库状态（confirmed/draft/ignored）、
                            JD 匹配降级策略决定工作台展示逻辑
  · PARALLEL_C1（用户分析）：tier1/2/3_count、ai_score 等埋点字段

注意：第 4.1 节（F2 Notion 三阶段 Pipeline 进度显示）属于 F2 专属，
已拆入 PARALLEL_A2_F2_Notion接入Pipeline.md

覆盖原文章节：第4章（仅4节标题+规格表+4.2）、第5章（5.1–5.2）
================================================================
-->

# **4. F1/F2 三档 AI 美化规格（统一标准）**
F1 和 F2 使用完全相同的 beautifyAchievement() 函数和 prompt\_configs 配置，两条路径美化标准完全一致。

|**档位**|**标记**|**判断条件**|**AI 行为**|
| :- | :- | :- | :- |
|第一档|🟢 已量化|已含数字/百分比/金额/时间对比/规模|保留所有原始数字（绝不修改），调整为「强动词→做了什么→结果数据」，去口语化，≤30字|
|第二档|🟡 待补充|有成果但缺数字，该类工作客观上有可量化指标|识别可量化维度，插入占位符[[类型:说明]]；简历中高亮橙色；提示「这个数字很重要」；不阻断主流程|
|第三档|🔴 主观描述|纯感受/态度类，无法量化|AI标注「建议补充具体案例」，保留用户原文，不强行改写|

## **4.2 草稿成就评分算法（三维度，运行在美化后文本上）**

|**评分维度**|**规则**|**权重**|**实现**|
| :- | :- | :- | :- |
|量化程度|有数字/百分比 → 0.9-1.0；有成果无数字 → 0.5-0.7；纯描述 → 0-0.3|40%|正则检测（本地）|
|表达完整度|「强动词+做了什么+结果」三要素齐全 → 高分；缺要素按比例扣|35%|qwen-turbo批量判断|
|职位相关性|与工作经历职位/技能标签的pgvector余弦相似度|25%|pgvector|

- 智能预选 Top 6 条，每个工作段至少1条，评分<0.3的工作段展示「暂无合适成就，建议手动添加」
- 初始简历预览顶部黄色提示：「📝 预览基于草稿内容，确认成就后提升质量」

# **5. 成就库状态管理**

|**状态**|**来源**|**说明**|**参与JD匹配**|
| :- | :- | :- | :- |
|draft|F2 Notion提取+三档美化后|已美化；可能含占位符（第二档）；参与智能预选初始预览|⚠ 仅初始预览/降级|
|confirmed|用户审核通过；F1提取后默认|正式成就库；含占位符显示🟡标记|✅ 完全参与|
|ignored|用户选择忽略|软删除；可从「已忽略」列表恢复|❌ 不参与|

## **5.1 成就完整数据字段**

|**字段**|**说明**|
| :- | :- |
|experience\_id|关联 work\_experiences 表；每条成就必须绑定工作经历，按工作段分组展示|
|text|三档美化后的文本；第二档含[[类型:说明]]占位符|
|status|draft / confirmed / ignored|
|tier|1/2/3（三档美化的档位）|
|has\_placeholders|Boolean，是否含未填占位符|
|ai\_score|草稿评分（0-1.0）；量化程度40%+完整度35%+相关性25%|
|source|'f1\_parse' \| 'f2\_notion' \| 'manual'|
|notion\_task\_id|来源Notion任务ID（去重用）；F1路径为null|
|original\_notion\_text|F2路径保留原始Notion文本，可回溯|
|embedding|1536维向量（占位符替换为{类型}后的文本上做embedding）|

## **5.2 JD匹配降级策略**

|**场景**|**匹配策略**|**用户提示**|
| :- | :- | :- |
|confirmed≥3条|正常：pgvector余弦（阈值0.65），Top K|无提示|
|confirmed 1-2条|混合：confirmed全选+draft评分≥0.6补充|「成就较少，已补充草稿内容」|
|confirmed=0|降级：全用draft评分Top 6条|「正在使用草稿预览，确认成就后生成正式版本」|

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-S03 · 任务清单

### T-S03-1　`prompt_configs` 表 + `getPrompt()` 热更新函数
| 项 | 内容 |
|---|---|
| **输入** | prompt 名称（如 `beautify_tier_classify_zh`）；DB `prompt_configs` 表；Redis cache |
| **输出** | 返回当前激活版本的 prompt 字符串（含 `{{变量}}` 占位符已被替换）；Redis TTL 300s |
| **关键步骤** | 建表 `prompt_configs`（`name / version / content / model / active`）→ `getPrompt(name, vars)` 函数（Redis `prompt:{name}` → DB active=true → fallback 本地默认）→ 字符串模板替换 `{{职位}}` 等变量 → Admin 更新接口（插新版本 + 翻转 active + del Redis key） |
| **验收标准** | ① `getPrompt('beautify_tier_classify_zh')` 在 Redis 命中时 < 5ms；② Admin 更新 prompt 后，下一次 AI 调用使用新版本（无需发版）；③ DB 宕机时使用本地 fallback，不抛异常；④ Redis TTL 精确为 300s（±5s） |

### T-S03-2　`beautifyAchievement(text, context)` 核心函数
| 项 | 内容 |
|---|---|
| **输入** | `text: string`（原始成就文本）；`context: { position: string, industry?: string, lang: 'zh'｜'en' }` |
| **输出** | `{ beautifiedText: string, tier: 1｜2｜3, hasPlaceholders: boolean, rationale: string }` |
| **关键步骤** | **步骤1（本地正则预判）**：检测数字/百分比/金额/规模关键词 → 命中则直接判 tier=1，跳过 AI 分类调用（降低成本）；**步骤2（AI 分类+改写）**：调用 Qwen，携带 `getPrompt('beautify_tier_classify_zh')` → 解析返回的 JSON `{tier, rewritten_text, placeholder_dimensions}`；**步骤3（tier 处理）**：tier=1 → 保留数字，仅调整句式；tier=2 → 插入 `[[类型:说明]]` 占位符，`hasPlaceholders=true`；tier=3 → 仅加标注，保留原文；**步骤4（降级）**：Qwen 失败 → 切 Claude（见 T-S03-5） |
| **验收标准** | ① tier=1：原始数字一字不差出现在 `beautifiedText` 中（正则断言）；② tier=2：`beautifiedText` 包含至少一个 `[[.*:.*]]` 格式字符串；③ tier=3：`beautifiedText` 包含原文关键词（未被完全改写）；④ 200 条测试样本，三档分类准确率 ≥ 85%（人工核验）；⑤ 单次调用 P95 耗时 ≤ 3s |

### T-S03-3　草稿评分算法 `scoreAchievement(text, positionEmbedding)`
| 项 | 内容 |
|---|---|
| **输入** | `text: string`（美化后文本，含占位符）；`positionEmbedding: number[]`（该成就关联工作段的职位向量） |
| **输出** | `score: number`（0–1.0）；`dimensions: { quantification: number, completeness: number, relevance: number }` |
| **关键步骤** | **维度1量化程度**（本地）：正则计数数字/百分比 → 映射到 0–1；**维度2表达完整度**（qwen-turbo 批量）：最多 10 条打一次 batch 请求，返回每条三要素评分；**维度3职位相关性**（pgvector）：先为成就文本生成 embedding（将占位符替换为 `{类型}` 后），再与 `positionEmbedding` 做余弦相似度；**综合加权**：`0.4*q + 0.35*c + 0.25*r` |
| **验收标准** | ① 包含明确数字的成就，`dimensions.quantification` ≥ 0.85；② 纯感受描述（如「工作态度积极」），`score` ≤ 0.35；③ 批量评分 30 条的总耗时 ≤ 8s（含 qwen-turbo 调用）；④ pgvector 余弦查询有 ivfflat 索引，百万级数据查询 < 100ms |

### T-S03-4　`achievements` 表 Schema + RLS + Embedding 异步队列
| 项 | 内容 |
|---|---|
| **输入** | F1/F2 写入的成就记录（含 `text, tier, status, source, experience_id`） |
| **输出** | 完整的 `achievements` 表（含 `embedding vector(1536)`）；RLS 策略生效；新增/更新触发 embedding 异步计算 |
| **关键步骤** | 建表（见 PRD 5.1 所有字段）→ 建 ivfflat 索引（`embedding vector_cosine_ops`）→ RLS：`auth.uid() = user_id OR current_setting('app.anonymous_id') = anonymous_id` → Supabase Edge Function 或队列：监听 `achievements` INSERT/UPDATE，异步计算 embedding → 回写 `embedding` 字段 |
| **验收标准** | ① 直接用 SQL 查询他人成就返回 0 行（RLS 验证）；② 新增成就后 ≤ 10s，`embedding` 字段有值（非 null）；③ `SELECT id FROM achievements ORDER BY embedding <=> $1 LIMIT 6` 在 10 万条数据下 < 50ms |

### T-S03-5　AI 模型降级策略 `callAI(prompt, options)`
| 项 | 内容 |
|---|---|
| **输入** | `prompt: string`；`options: { model?: 'qwen-plus'｜'qwen-turbo', maxRetries?: number }` |
| **输出** | `{ text: string, modelUsed: string, fallbackTriggered: boolean }` |
| **关键步骤** | 封装统一 `callAI()` → 先调 Qwen → 超时（>30s）或 5xx → retry 1 次 → 再失败 → 切 Claude Sonnet 4（高质量）→ Claude 也失败 → 切 Claude Haiku 4.5（最后兜底）→ 全部失败 → 抛 `AIUnavailableError` → Redis 记录健康状态 `ai:qwen:healthy=false`（TTL 5分钟）→ 触发 `ai_model_fallback` 埋点事件 |
| **验收标准** | ① Mock Qwen 返回 503，`callAI()` 自动切换 Claude，函数正常返回（不抛错）；② 降级时 `ai_model_fallback` 事件写入 analytics；③ Redis 健康状态 TTL 精确 5分钟；④ Qwen 健康状态恢复后（TTL 过期），下次调用重新走 Qwen |

### T-S03-6　JD 匹配降级策略 `matchAchievements(userId, jdText, confirmedCount)`
| 项 | 内容 |
|---|---|
| **输入** | `userId`；JD 文本（可为空）；`confirmedCount`（DB 查询） |
| **输出** | `{ achievements: Achievement[], strategy: 'normal'｜'mixed'｜'fallback', warningMessage?: string }` |
| **关键步骤** | 查 confirmed 数量 → 分支：`≥3` 正常向量匹配（阈值 0.65）；`1-2` confirmed 全选 + draft 补充（score≥0.6）；`0` 全用 draft Top 6 → 同时返回对应 `warningMessage` 供前端展示 |
| **验收标准** | ① `confirmed=0` 时，返回 6 条 draft，`strategy='fallback'`，`warningMessage` 非空；② `confirmed=5, jdText` 存在，返回向量相似度排序的 Top K（K 由简历模板决定，默认 6）；③ 阈值 0.65 可通过 `paywall_settings` 扩展配置（预留字段即可） |

---

## AC-S03 · 模块整体验收标准

1. **Beta 上线前必测**：准备 200 条真实成就样本，人工核验三档分类，准确率 ≥ 85%
2. **数字零修改**：对 100 条 tier=1 成就（已有数字），验证美化后的数字与原文完全一致
3. **占位符格式**：100 条 tier=2 成就，所有占位符均符合 `[[类型:说明]]` 正则格式，无格式异常
4. **性能基准**：单条 `beautifyAchievement()` P95 ≤ 3s；30 条批量评分 ≤ 8s
5. **降级覆盖**：单元测试覆盖 Qwen 超时、Qwen 5xx、Claude 降级三种场景，均不向用户报错
