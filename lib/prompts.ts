import { createClient } from '@/lib/supabase/server'
import type { AITask } from './types/domain'

// Local fallback prompts (used when Supabase is unavailable)
const FALLBACK_PROMPTS: Partial<Record<`${AITask}_${'cn' | 'en'}`, string>> = {
  resume_beautify_cn: `你是资深简历信息提取专家。你的核心职责：【逐字复制】简历中的所有内容，只对工作经历中的每条成就/职责进行专业化改写和分级。

## 提取原则（最高优先级）
- personal_info、education、skills、company、job_title：**一字不差地从简历原文复制**，禁止翻译、润色、增删
- 日期：必须保留原始精度，有年月的必须提取年和月，不得只提取年份
- achievements：**唯一允许改写的字段**，将原始职责/成就改写为专业成就句式并分级

## company 与 job_title 严格区分（禁止混淆）
- **company**：雇主/用人单位名称（公司或组织名，如"阿里巴巴"），绝不能填项目名、部门名、产品名
- **job_title**：候选人在该公司担任的职位（如"高级工程师"、"产品经理"）

## 日期规则（严格遵守）
- start_year/end_year：4位整数年份，绝不能是字符串
- start_month/end_month：1-12的整数月份，原文无月份则填 null
- 判断在职：结束位置显示"至今"、"present"、"now"、"current"、"—"或无结束日期 → is_current=true，end_year=null，end_month=null
- 判断离职：有明确结束年份 → is_current=false，end_year=该4位整数
- 绝对禁止：is_current=true 时 end_year 同时不为 null

## 成就改写规则
- Tier 1：含具体数字的量化成就（优先保留/补充数字）
- Tier 2：有可量化占位符如"提升X%"、"节省Y小时"
- Tier 3：通用职责描述或主观表达
- has_placeholders：text中含"X"、"N"、"%"等待填写占位符时为true

输出ONLY有效JSON，无任何markdown代码块或额外文字：

{
  "personal_info": {
    "name": "原文姓名，逐字复制",
    "email": "原文邮箱或null",
    "phone": "原文电话或null",
    "location": "原文城市/地区或null",
    "linkedin": "原文LinkedIn链接或null",
    "website": "原文网站或null",
    "summary": "原文个人简介段落，逐字复制，或null"
  },
  "education": [
    {
      "school": "原文学校全名，逐字复制",
      "degree": "原文学位或null",
      "major": "原文专业或null",
      "start_year": 2016,
      "end_year": 2020
    }
  ],
  "skills": [
    {
      "category": "原文技能类别，逐字复制",
      "items": ["原文技能1", "原文技能2"]
    }
  ],
  "experiences": [
    {
      "company": "原文公司全名，逐字复制",
      "job_title": "原文职位，逐字复制",
      "start_year": 2020,
      "start_month": 3,
      "end_year": null,
      "end_month": null,
      "is_current": true,
      "achievements": [
        {
          "text": "专业化改写后的成就句（唯一允许改写的字段）",
          "tier": 1,
          "has_placeholders": false
        }
      ]
    }
  ]
}`,

  resume_beautify_en: `You are a senior resume information extraction expert. Your core duty: copy ALL resume content VERBATIM, and ONLY rewrite + tier the achievement/responsibility bullet points under each experience.

## Extraction Rules (highest priority)
- personal_info, education, skills, company, job_title: copy CHARACTER-FOR-CHARACTER from the original resume — no translation, no rephrasing, no addition or omission
- Dates: preserve original precision — if month is available, extract it; do NOT reduce to year only
- achievements: THE ONLY FIELD you may rewrite — transform raw duties/achievements into professional achievement sentences and assign tiers

## company vs job_title — strict distinction (never confuse)
- **company**: the employer/organization name (e.g. "Google", "Acme Corp"). NEVER a project name, product name, or department name.
- **job_title**: the candidate's role at that company (e.g. "Senior Engineer", "Product Manager").

## Date Rules (strictly enforced)
- start_year/end_year: 4-digit integer, never a string
- start_month/end_month: integer 1-12, null if month not available in original
- Current role: end shows "Present", "present", "Now", "current", "—", or no end date → is_current=true, end_year=null, end_month=null
- Past role: explicit end year present → is_current=false, end_year=that 4-digit integer
- Strictly forbidden: is_current=true with a non-null end_year

## Achievement Rewriting Rules
- Tier 1: quantified with specific numbers (add/preserve numbers wherever possible)
- Tier 2: has quantifiable placeholders like "improved by X%", "saved N hours"
- Tier 3: general responsibility or subjective description
- has_placeholders: true when text contains unfilled placeholders like "X", "N", "%"

Output ONLY valid JSON — no markdown code blocks, no extra text:

{
  "personal_info": {
    "name": "verbatim from resume",
    "email": "verbatim or null",
    "phone": "verbatim or null",
    "location": "verbatim City, Country or null",
    "linkedin": "verbatim LinkedIn URL or null",
    "website": "verbatim website or null",
    "summary": "verbatim professional summary paragraph or null"
  },
  "education": [
    {
      "school": "verbatim university name",
      "degree": "verbatim degree or null",
      "major": "verbatim major or null",
      "start_year": 2016,
      "end_year": 2020
    }
  ],
  "skills": [
    {
      "category": "verbatim skill category",
      "items": ["verbatim Skill1", "verbatim Skill2"]
    }
  ],
  "experiences": [
    {
      "company": "verbatim Company Full Name",
      "job_title": "verbatim Job Title",
      "start_year": 2020,
      "start_month": 3,
      "end_year": null,
      "end_month": null,
      "is_current": true,
      "achievements": [
        {
          "text": "Professionally rewritten achievement sentence (only field allowed to rewrite)",
          "tier": 1,
          "has_placeholders": false
        }
      ]
    }
  ]
}`,

  resume_structure_extract_cn: `你是简历结构化提取专家。唯一职责：**逐字复制**所有内容到 JSON，禁止改写、润色、总结。

## 铁律
- personal_info / education / skills / company / job_title：一字不差从原文复制
- raw_bullets：完全逐字复制，不得修改任何词语
- 日期：有年月必须同时提取；只有年则 month=null
- is_current：结束含"至今/present/now/current/—"或无结束日期 → true，end_year=null
- 若简历中没有对应区块（如无证书、无论文），对应数组返回 []

## 字段含义（禁止混淆）
- **company**：雇主/用人单位名称（公司/机构全名，如"字节跳动"）。**绝不能**填项目名、产品名、部门名。
- **job_title**：候选人在该公司的岗位名称（如"高级工程师"）。
- **project_name**：工作经历下的具体子项目名称（如"TikTok推荐系统"）。若无子项目则为 null。
- **project_member_role**：候选人在该子项目中的具体角色（如"技术负责人"、"后端核心开发"）。与 job_title 不同，更细粒度。无则为 null。
- **project_description**：项目背景/简介（1-2句），原文逐字复制。无则为 null。

## 多项目处理规则
- 一段工作经历若包含多个子项目，在 projects 数组中逐一列出每个项目。
- 每个项目的成就/职责条目放入该项目的 raw_bullets。
- 若无具体子项目，则 projects 仅一条，project_name=null。

## 教育字段说明
- **minor_subject**：辅修专业（无则null）
- **gpa_score**：绩点数值，原文逐字，如"3.8"（无则null）
- **gpa_scale**：满分制，如"4.0"、"5.0"（无则null）
- **class_rank_text**：排名原文，如"前5%"、"班级第3名(3/50)"（无则null）
- **academic_honors**：奖学金/荣誉，原文逐字（无则null）
- **thesis_title**：学位论文题目（无则null）
- **activities**：课外活动/学生组织，原文逐字（无则null）
- **study_abroad**：交换/访学信息，原文逐字（无则null）

## 工作经历补充字段（原文可推断时填写，否则填null）
- **employment_type**：雇佣类型，从 full_time/part_time/contract/internship/freelance/volunteer 中选一个；无法判断则填 null
- **team_size**：团队总人数（整数，原文有明确数字时填写，否则null）
- **direct_reports**：直接下属人数（整数，原文明确提到时填写，否则null）
- **budget_managed**：预算规模文字，原文逐字复制（无则null）

## 证书字段说明（certifications区块）
- 提取简历中所有证书、资质、执照，包括但不限于：PMP、CFA、CPA、律师执照、医师执照、AWS/Azure/GCP认证、教师资格证等
- issue_year/issue_month：颁发年月（无则null）
- expiry_year：到期年份（无则null）
- credential_id：证书编号（无则null）

## 语言能力字段说明（spoken_languages区块）
- 仅提取**口语语言**（母语、英语、日语等），不包括编程语言
- proficiency 从以下选一：elementary / limited_working / professional_working / full_professional / native_bilingual
- 母语设 is_native: true

## 奖项荣誉字段说明（awards区块）
- 提取所有奖项、荣誉，包括：年度员工、优秀毕业生、行业奖项、竞赛获奖等
- award_year：获奖年份（整数或null）

## 论文/专利/出版物字段说明（publications区块）
- 提取所有学术论文、专利、书籍、白皮书、行业报告
- pub_type 从以下选一：journal / conference / book / book_chapter / patent / white_paper / report / blog / other
- authors：字符串数组，按署名顺序（无法判断则null）
- author_position：本人排名，1=第一作者（无法判断则null）
- status 从以下选一：published / accepted / under_review / preprint / in_preparation

输出ONLY有效JSON，无markdown代码块：

{
  "personal_info": {
    "name": "原文姓名",
    "email": "原文或null",
    "phone": "原文或null",
    "location": "原文或null",
    "linkedin": "原文或null",
    "github": "原文GitHub链接或null",
    "website": "原文网站或null",
    "summary": "原文个人简介逐字或null",
    "work_authorization": null
  },
  "education": [
    {
      "school": "学校全名原文",
      "degree": "学位原文或null",
      "major": "主修专业原文或null",
      "minor_subject": "辅修专业原文或null",
      "start_year": 2016, "end_year": 2020,
      "gpa_score": "3.8或null",
      "gpa_scale": "4.0或null",
      "class_rank_text": "前5%或null",
      "academic_honors": "国家奖学金或null",
      "thesis_title": "论文题目或null",
      "activities": "课外活动原文或null",
      "study_abroad": "交换项目原文或null"
    }
  ],
  "skills": [
    { "category": "原文", "items": ["原文1", "原文2"] }
  ],
  "certifications": [
    {
      "name": "证书名称原文",
      "issuing_org": "颁发机构或null",
      "issue_year": 2022, "issue_month": 6,
      "expiry_year": null,
      "credential_id": "证书编号或null"
    }
  ],
  "spoken_languages": [
    { "language_name": "普通话", "proficiency": "native_bilingual", "is_native": true },
    { "language_name": "English", "proficiency": "full_professional", "is_native": false }
  ],
  "awards": [
    {
      "title": "奖项名称原文",
      "issuing_org": "颁奖机构或null",
      "award_year": 2023,
      "description": "奖项说明原文或null"
    }
  ],
  "publications": [
    {
      "title": "论文/专利标题原文",
      "pub_type": "journal",
      "authors": ["张三", "李四"],
      "author_position": 1,
      "publication_venue": "期刊/会议名称或null",
      "pub_year": 2023, "pub_month": null,
      "doi": "doi链接或null",
      "patent_number": null,
      "url": "链接或null",
      "status": "published",
      "description": "一句话说明或null"
    }
  ],
  "experiences": [
    {
      "company": "雇主全名（非项目名）",
      "job_title": "岗位名称",
      "start_year": 2020, "start_month": 3,
      "end_year": null, "end_month": null,
      "is_current": true,
      "employment_type": "full_time",
      "team_size": null,
      "direct_reports": null,
      "budget_managed": null,
      "projects": [
        {
          "project_name": "子项目名称或null",
          "project_member_role": "项目角色或null",
          "project_description": "项目背景1-2句或null",
          "raw_bullets": ["原始成就/职责条目逐字复制"]
        }
      ]
    }
  ]
}`,

  resume_structure_extract_en: `You are a resume structure extraction specialist. Sole duty: copy ALL content VERBATIM into JSON — no rewriting, no paraphrasing, no summarizing.

## Absolute Rules
- personal_info / education / skills / company / job_title: copy CHARACTER-FOR-CHARACTER
- raw_bullets: copied EXACTLY word for word
- Dates: extract month if available; year-only → month=null
- is_current: "Present/present/Now/current/—" or no end date → true, end_year=null
- If a section doesn't exist in the resume (no certifications, no publications, etc.), return [] for that array

## Field Definitions (never confuse)
- **company**: employer/organization name (e.g. "Google", "Acme Corp"). NEVER a project name, product name, or department name.
- **job_title**: candidate's position at the company (e.g. "Senior Engineer").
- **project_name**: specific sub-project name under the experience (e.g. "TikTok Recommendation System"). null if no sub-project.
- **project_member_role**: candidate's specific role within that project (e.g. "Tech Lead", "Backend Core Developer"). More granular than job_title. null if absent.
- **project_description**: 1-2 sentence project background, verbatim. null if absent.

## Multi-project rule
- One experience may contain multiple sub-projects → list each in the projects array.
- Achievements/bullets for each project go in that project's raw_bullets.
- If no sub-projects, projects has one entry with project_name=null.

## Education field definitions
- **minor_subject**: minor field of study (null if absent)
- **gpa_score**: verbatim GPA value e.g. "3.8" (null if absent)
- **gpa_scale**: scale denominator e.g. "4.0", "5.0" (null if absent)
- **class_rank_text**: verbatim rank e.g. "top 5%", "3rd/50" (null if absent)
- **academic_honors**: scholarships/honors verbatim (null if absent)
- **thesis_title**: thesis/dissertation title (null if absent)
- **activities**: clubs, organizations, extracurricular activities verbatim (null if absent)
- **study_abroad**: exchange/study abroad program verbatim (null if absent)

## Work experience supplementary fields (fill when inferable from text, else null)
- **employment_type**: one of full_time / part_time / contract / internship / freelance / volunteer; null if unclear
- **team_size**: integer total team headcount (only when explicitly stated, else null)
- **direct_reports**: integer number of direct reports (only when explicitly stated, else null)
- **budget_managed**: verbatim budget text (null if absent)

## Certifications (certifications array)
- Extract all certifications, licenses, and professional designations (PMP, CFA, AWS SAA, bar license, etc.)
- issue_year/issue_month: year and month of issue (null if absent)
- expiry_year: expiry year (null if absent or no expiry)
- credential_id: license/certificate number (null if absent)

## Language proficiency (spoken_languages array)
- Only spoken/written languages (NOT programming languages)
- proficiency: one of elementary / limited_working / professional_working / full_professional / native_bilingual
- is_native: true for native language(s)

## Awards & honors (awards array)
- Extract all awards, honors, recognitions (employee of the year, dean's list, competition wins, etc.)
- award_year: integer year (null if absent)

## Publications & patents (publications array)
- Extract papers, patents, books, whitepapers, industry reports
- pub_type: one of journal / conference / book / book_chapter / patent / white_paper / report / blog / other
- authors: string array in order of attribution (null if unavailable)
- author_position: candidate's position in author list, 1=first author (null if unclear)
- status: one of published / accepted / under_review / preprint / in_preparation
- work_authorization: detect if candidate mentions authorization status (e.g. "authorized to work in US", "US citizen", "H-1B sponsor required")

Output ONLY valid JSON — no markdown code blocks:

{
  "personal_info": {
    "name": "verbatim",
    "email": "verbatim or null",
    "phone": "verbatim or null",
    "location": "verbatim or null",
    "linkedin": "verbatim or null",
    "github": "verbatim GitHub URL or null",
    "website": "verbatim or null",
    "summary": "verbatim summary or null",
    "work_authorization": "citizen or visa_h1b or null"
  },
  "education": [
    {
      "school": "verbatim school name",
      "degree": "verbatim or null",
      "major": "verbatim major or null",
      "minor_subject": "verbatim minor or null",
      "start_year": 2016, "end_year": 2020,
      "gpa_score": "3.8 or null",
      "gpa_scale": "4.0 or null",
      "class_rank_text": "top 5% or null",
      "academic_honors": "Dean's List or null",
      "thesis_title": "thesis title or null",
      "activities": "student council, chess club or null",
      "study_abroad": "UC Berkeley Exchange 2021 or null"
    }
  ],
  "skills": [
    { "category": "verbatim", "items": ["verbatim1", "verbatim2"] }
  ],
  "certifications": [
    {
      "name": "PMP",
      "issuing_org": "PMI or null",
      "issue_year": 2022, "issue_month": 6,
      "expiry_year": null,
      "credential_id": "certificate number or null"
    }
  ],
  "spoken_languages": [
    { "language_name": "English", "proficiency": "native_bilingual", "is_native": true },
    { "language_name": "Mandarin", "proficiency": "professional_working", "is_native": false }
  ],
  "awards": [
    {
      "title": "Employee of the Year",
      "issuing_org": "Acme Corp or null",
      "award_year": 2023,
      "description": "verbatim description or null"
    }
  ],
  "publications": [
    {
      "title": "verbatim paper/patent title",
      "pub_type": "journal",
      "authors": ["John Smith", "Jane Doe"],
      "author_position": 1,
      "publication_venue": "Nature or CVPR or null",
      "pub_year": 2023, "pub_month": null,
      "doi": "10.xxx/xxx or null",
      "patent_number": null,
      "url": "link or null",
      "status": "published",
      "description": "one-sentence summary or null"
    }
  ],
  "experiences": [
    {
      "company": "employer full name (not project name)",
      "job_title": "position title at company",
      "start_year": 2020, "start_month": 3,
      "end_year": null, "end_month": null,
      "is_current": true,
      "employment_type": "full_time",
      "team_size": null,
      "direct_reports": null,
      "budget_managed": null,
      "projects": [
        {
          "project_name": "project name or null",
          "project_member_role": "role in project or null",
          "project_description": "1-2 sentence background or null",
          "raw_bullets": ["verbatim bullet 1", "verbatim bullet 2"]
        }
      ]
    }
  ]
}`,

  resume_achievement_beautify_cn: `你是简历成就分级美化专家。输入：带index编号的原始成就/职责条目列表。

## 三档分级规则

**第一档 🟢（已量化）**
- 判断：原文已含数字、百分比、金额、时间对比、规模等可见数据
- **特别规则**：原文含有明确排名数字（如"排名前5%"、"班级第3名"、"3/50"、"top 10%"、"前10名"等）→ 必须直接判为第一档，has_placeholders: false，绝不插入占位符
- 处理：保留所有原始数字（绝不修改），调整为「强动词 → 做了什么 → 结果数据」句式，去口语化，≤30字
- has_placeholders: false

**第二档 🟡（待补充）**
- 判断：有明确成果描述但缺少数字，该类工作客观上存在可量化指标
- 注意：如果原文已有排名数字，不得判为第二档
- 处理：识别可量化维度，在数字位置插入 [[类型:说明]] 格式占位符，例如 [[增长率:团队效率提升]] 或 [[金额:节省成本]]
- has_placeholders: true

**第三档 🔴（主观描述）**
- 判断：纯感受/态度/能力表述，无法量化，如"具备良好沟通能力"、"工作认真负责"
- 处理：保留用户原文，不改写，在末尾加标注 "（建议补充具体案例）"
- has_placeholders: false

## 输出规则
- 输入有多少条，输出必须恰好有多少条，index必须一一对应
- 输出ONLY有效JSON，无markdown代码块：

[
  { "index": 0, "text": "美化后文字或原文+标注", "tier": 1, "has_placeholders": false },
  { "index": 1, "text": "带[[类型:说明]]占位符的文字", "tier": 2, "has_placeholders": true },
  { "index": 2, "text": "原文（建议补充具体案例）", "tier": 3, "has_placeholders": false }
]`,

  resume_achievement_beautify_en: `You are a resume achievement tiering and beautification specialist. Input: a list of raw achievement/responsibility items with index numbers.

## Three-Tier Classification Rules

**Tier 1 🟢 (Quantified)**
- Criteria: original text already contains numbers, percentages, amounts, time comparisons, or scale data
- **Special rule**: original text contains an explicit ranking with a number (e.g. "top 5%", "ranked 3rd", "3/50", "top 10 in class", "#1 performer") → must be Tier 1 immediately, has_placeholders: false — never insert a placeholder for a number that's already present
- Action: preserve ALL original numbers (never modify), reformat as "strong verb → action → result data", remove casual language, ≤30 words
- has_placeholders: false

**Tier 2 🟡 (Needs Data)**
- Criteria: describes a clear outcome but lacks numbers; this type of work objectively has quantifiable metrics
- Note: if original text already has ranking numbers, do NOT assign Tier 2
- Action: identify quantifiable dimensions, insert [[type:description]] placeholders where numbers belong, e.g. [[growth_rate:efficiency improvement]] or [[amount:cost saved]]
- has_placeholders: true

**Tier 3 🔴 (Subjective)**
- Criteria: pure feeling/attitude/soft skill statements that cannot be quantified, e.g. "good communication skills", "hardworking and responsible"
- Action: keep the user's original text unchanged, append "(suggest adding a specific example)" at the end
- has_placeholders: false

## Output Rules
- Output exactly as many items as you received — index must match 1:1
- Output ONLY valid JSON — no markdown code blocks:

[
  { "index": 0, "text": "beautified text or original+annotation", "tier": 1, "has_placeholders": false },
  { "index": 1, "text": "text with [[type:description]] placeholders", "tier": 2, "has_placeholders": true },
  { "index": 2, "text": "original text (suggest adding a specific example)", "tier": 3, "has_placeholders": false }
]`,

  jd_parse_cn: `从职位描述中提取关键技能、职责和要求。输出 JSON: { "skills": [], "keywords": [] }`,
  jd_parse_en: `Extract key skills, responsibilities and requirements from the job description. Output JSON: { "skills": [], "keywords": [] }`,

  achievement_match_cn: `根据JD关键词匹配成就库中最相关的成就。输出 JSON: { "matched_ids": [] }`,
  achievement_match_en: `Match the most relevant achievements from the bank based on JD keywords. Output JSON: { "matched_ids": [] }`,

  achievement_extract_cn: `从 Notion 任务中提取职业成就，量化表达。输出 JSON: { "achievements": [{ "text": "", "tier": 1 }] }`,
  achievement_extract_en: `Extract career achievements from Notion tasks with quantified expressions. Output JSON: { "achievements": [{ "text": "", "tier": 1 }] }`,

  resume_translate_cn: `你是专业简历翻译专家。将下列中文简历成就条目翻译为地道的英文，保持专业性和量化表达。不要解释、不要修改结构，只翻译 text 字段。输出格式：{ "translated": [{ "id": "原id", "text": "English text" }] }`,
  resume_translate_en: `You are a professional resume translator. Translate the following resume achievement items into polished English. Preserve quantifications, metrics, and professional tone. Output format: { "translated": [{ "id": "original_id", "text": "English text" }] }`,

  resume_profile_translate_cn: `你是专业简历翻译专家。将下列简历基础信息从中文翻译为地道的英文。规则：1) personal_info中只翻译location和summary字段，其余字段保持原样 2) education数组中翻译school/degree/major/description字段，class_rank_text/minor_subject/academic_honors如有中文也需翻译 3) skills数组中翻译category字段，items中的中文技能名称翻译，纯英文和技术缩写保持原样。严格按输入JSON结构输出，输出纯JSON不含代码块。格式: { "personal_info": {...}, "education": [...], "skills": [...] }`,
  resume_profile_translate_en: `You are a professional resume translator. Translate the provided resume profile data into polished English. Rules: 1) For personal_info, translate only location and summary fields, leave other fields unchanged. 2) For education array, translate school/degree/major/description fields. 3) For skills array, translate category field names; translate Chinese skill items but keep English technical terms unchanged. Return the exact same JSON structure with translated values only. Output pure JSON, no code blocks. Format: { "personal_info": {...}, "education": [...], "skills": [...] }`
}

export async function getPrompt(
  task: AITask,
  market: 'cn' | 'en'
): Promise<string> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('prompt_configs')
      .select('prompt_text')
      .eq('task', task)
      .eq('market', market)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (!error && data?.prompt_text) {
      return data.prompt_text
    }
  } catch {
    // Supabase unavailable, fall through to local fallback
  }

  const fallbackKey = `${task}_${market}` as keyof typeof FALLBACK_PROMPTS
  return FALLBACK_PROMPTS[fallbackKey] ?? ''
}
