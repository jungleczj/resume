<!--
================================================================
CareerFlow PRD v5.9 — 拆分子文件
文件编号：PARALLEL_C2（最早可并行启动的非代码任务，纯数据准备）
================================================================
【可并行开发 / 数据准备任务，优先级 P0，建议第一周启动】
前置依赖：
  · SERIAL_01 产品总览（了解用户类型即可开始数据整理）

无代码依赖，可与所有开发模块并行推进：
  · 此任务是纯数据整理工作（Excel/CSV → SQL seed 文件），
    无需等待任何代码模块完成
  · PARALLEL_A2（F2 Pipeline）的 Step 0.1 基本信息填写需要用到选项库，
    但可先用空数组联调 UI，seed 数据完成后直接导入即可

本文件负责人交付物（PRD 13.1 标注为 P0 决策）：
  · seed_positions.sql（100条职位，含 name_zh/name_en/industry）
  · seed_skills.sql（300条技能，含分类：编程/框架/工具/软技能/语言）
  · seed_companies.sql（国内TOP500 + Fortune500）
  · seed_schools.sql（国内985/211 + 全球QS200）
  · 以上均写入 Supabase seed 表，随发版更新

覆盖原文章节：第8章（选项库预置数据规范）
================================================================
-->

# **8. 选项库预置数据规范（v5.5）**
- 职位标签库：预置100个常见职位（按行业分类），支持自定义
- 公司搜索提示：国内TOP500 + 全球Fortune 500，支持自由输入
- 学校库：国内985/211 + 全球QS200，支持自由输入
- 技能标签库：预置300个（编程/框架/工具/软技能/语言），按类别，上限20个
- 维护方式：Supabase seed表，随发版更新；所有字段支持自定义输入（「+添加XX」选项）

---

# 📋 开发任务分析（追加）

> 本章节为技术分析追加内容，不修改原 PRD 正文。

## T-C2 · 任务清单

### T-C2-1　数据整理（非代码，P0，第一周启动）
| 项 | 内容 |
|---|---|
| **输入** | 公开数据源：职联、Boss直聘职位分类；LinkedIn 职位库；Fortune 500/中国500强名单；QS 世界大学排名；TIOBE/Stack Overflow 技能调研 |
| **输出** | 四份 CSV 文件：`positions_100.csv`（职位）、`skills_300.csv`（技能）、`companies_1000.csv`（公司）、`schools_600.csv`（学校）；每条数据含 `name_zh / name_en / category` 字段 |
| **关键步骤** | 职位：按行业分组（互联网/金融/制造/教育/医疗等），确保覆盖常见职位；技能：按类别（编程语言/框架/工具/软技能/语言证书），排除过时技能；公司：国内TOP500（营收排序）+ Fortune 500（全球）；学校：国内 985/211 全集（约115所）+ QS Top 200 |
| **验收标准** | ① CSV 行数：positions ≥ 100、skills ≥ 300、companies ≥ 500、schools ≥ 300；② 无重复行（`name_zh` 唯一）；③ `name_en` 字段均有值（用于英文简历展示）；④ 所有条目的 `category` 字段不为空；⑤ 第一周内输出 CSV，供 A2 Step 0.1 联调使用 |

### T-C2-2　Seed SQL 文件编写与 DB 导入
| 项 | 内容 |
|---|---|
| **输入** | T-C2-1 产出的四份 CSV 文件 |
| **输出** | 四份 SQL Migration 文件：`seed_positions.sql / seed_skills.sql / seed_companies.sql / seed_schools.sql`；在 staging + production DB 执行成功 |
| **关键步骤** | 建四张 seed 表（`id serial, name_zh text unique, name_en text, category/industry text`）→ Python/Node 脚本将 CSV 转为 `INSERT` SQL（使用 `ON CONFLICT DO NOTHING` 保证幂等）→ 在 staging 环境执行验证 → 写入 Supabase Migration 文件 → 纳入 CI/CD（每次部署自动 seed） |
| **验收标准** | ① seed SQL 可幂等执行（重复执行不报错，不重复插入）；② staging 环境 `SELECT count(*) FROM seed_skills` 返回 ≥ 300；③ CI/CD 流水线中 seed 步骤成功执行（无需人工干预）；④ Production 执行后数据量与 staging 一致 |

### T-C2-3　前端搜索组件封装
| 项 | 内容 |
|---|---|
| **输入** | 用户键入关键词；seed 表数据 |
| **输出** | 公司/学校：防抖服务端搜索（`ilike`）；职位/技能：前端本地过滤；所有选项支持「+添加自定义」 |
| **关键步骤** | `<SearchSelect>` 通用组件：props：`mode: 'server'｜'local'`，`dataSource: SeedItem[]｜string`（API path），`onCreate: (value) => void`（自定义输入），`maxSelect?: number`（上限校验）→ `mode=server`：防抖 300ms → `GET /api/seed/companies?q={keyword}` → `ilike '%keyword%'` 查询 → `mode=local`：一次性 fetch 全量数据 → 本地 filter → 末尾追加「+添加 {keyword}」选项 |
| **验收标准** | ① 输入「阿里」，下拉显示「阿里巴巴」等匹配项（服务端搜索，防抖 300ms 后触发）；② 输入「MyStartup」（数据库中不存在），下拉末尾出现「+添加 MyStartup」，点击后写入；③ 技能标签已选 20 个，再操作「+添加」被拦截，Toast 提示；④ `<SearchSelect>` 组件有 Storybook 文档，供 A2 Step 0.1 复用 |

### T-C2-4　选项库随版本更新机制
| 项 | 内容 |
|---|---|
| **输入** | 新版本 seed CSV（人工维护，季度更新） |
| **输出** | 更新后数据自动生效（新增条目）；已有条目不被覆盖（`ON CONFLICT DO NOTHING`） |
| **关键步骤** | 维护一份 `seeds/` 目录下的标准 SQL 文件 → CI/CD pipeline `deploy` 步骤执行 `psql -f seeds/*.sql` → `ON CONFLICT (name_zh) DO NOTHING` 保证存量数据不被覆盖 |
| **验收标准** | ① 新增 10 条技能到 CSV → 重新部署 → DB 新增 10 条，已有 290 条不变；② 手动删除一条数据再部署，该条不被重新插入（幂等性）；③ CI 流水线日志可见 seed 执行结果 |

---

## AC-C2 · 模块整体验收标准

1. **P0 交付时间**：四份 CSV 数据文件在**项目开发第一周**完成，Seed SQL 在第二周完成导入
2. **数据质量**：随机抽查 50 条职位标签、50 条技能标签，无拼写错误，中英文名称准确
3. **前端联调就绪**：PARALLEL_A2 Step 0.1 开始开发时，`seed_companies / seed_positions / seed_skills / seed_schools` 表数据已就绪（可用空数组联调 UI 逻辑，数据后续补充）
4. **搜索性能**：公司名搜索（服务端）响应时间 < 300ms（P95）；技能标签本地过滤 < 50ms
5. **自定义输入全覆盖**：所有四类选项（职位/技能/公司/学校）均支持用户自由输入，不强制从预置数据中选择
