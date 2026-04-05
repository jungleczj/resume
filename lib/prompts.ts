import { createClient } from '@/lib/supabase/server'
import type { AITask } from './types/domain'

// Local fallback prompts (used when Supabase is unavailable)
const FALLBACK_PROMPTS: Partial<Record<`${AITask}_${'cn' | 'en'}`, string>> = {
  resume_beautify_cn: `你是资深简历优化专家。完整分析简历，提取全部信息，严格输出以下 JSON（不要有任何额外文字或 markdown 代码块）。

日期规则（严格遵守，不得违反）：
- start_year/end_year 必须是4位整数年份（如 2020），绝不能是字符串
- 判断"当前在职"：简历中该段经历的结束位置显示"至今"、"present"、"now"、"current"、"—"或完全没有结束日期 → is_current=true，end_year=null
- 判断"已离职"：该段经历有明确的结束年份（如 2022年、2022.6、Jun 2022）→ is_current=false，end_year=该年份的4位整数（如 2022）
- 绝对禁止：is_current=true 时 end_year 同时不为 null；已有结束年份的经历设 is_current=true
- 若结束日期只有月份范围（如"2021年下半年"），取该年份整数

成就分级：Tier 1=含具体数字的量化成就，Tier 2=有占位符如"提升X%"，Tier 3=职责描述或主观表达。

{
  "personal_info": {
    "name": "姓名",
    "email": "邮箱或null",
    "phone": "电话或null",
    "location": "城市/国家或null",
    "linkedin": "LinkedIn链接或null",
    "website": "网站或null",
    "summary": "个人简介段落或null"
  },
  "education": [
    {
      "school": "学校全名",
      "degree": "学位（如本科/硕士/Bachelor/Master）或null",
      "major": "专业或null",
      "start_year": 2016,
      "end_year": 2020
    }
  ],
  "skills": [
    {
      "category": "技能类别（如编程语言/框架/工具/语言）",
      "items": ["技能1", "技能2"]
    }
  ],
  "experiences": [
    {
      "company": "公司全名",
      "job_title": "职位",
      "start_year": 2020,
      "end_year": null,
      "is_current": true,
      "achievements": [
        {
          "text": "成就描述（精炼、专业、突出价值）",
          "tier": 1,
          "has_placeholders": false
        }
      ]
    }
  ]
}`,

  resume_beautify_en: `You are a senior resume optimization expert. Analyze the resume fully and extract ALL information. Output ONLY valid JSON (no markdown code blocks, no extra text).

Date rules (strictly enforced):
- start_year/end_year must be 4-digit integers (e.g. 2020), never strings
- Current role: end of tenure shows "Present", "present", "Now", "current", "—", or no end date at all → is_current=true, end_year=null
- Past role: end of tenure shows a specific year (e.g. 2022, Jun 2022, 2022.06) → is_current=false, end_year=that 4-digit integer (e.g. 2022)
- Strictly forbidden: is_current=true when end_year is also non-null; marking a role with an explicit end year as is_current=true

Achievement tiers: Tier 1=quantified with specific numbers, Tier 2=has placeholders like "improved by X%", Tier 3=responsibility or subjective description.

{
  "personal_info": {
    "name": "Full Name",
    "email": "email or null",
    "phone": "phone or null",
    "location": "City, Country or null",
    "linkedin": "LinkedIn URL or null",
    "website": "website or null",
    "summary": "professional summary paragraph or null"
  },
  "education": [
    {
      "school": "University Full Name",
      "degree": "Bachelor/Master/PhD or null",
      "major": "Major or null",
      "start_year": 2016,
      "end_year": 2020
    }
  ],
  "skills": [
    {
      "category": "Skill category (e.g. Programming Languages / Frameworks / Tools)",
      "items": ["Skill1", "Skill2"]
    }
  ],
  "experiences": [
    {
      "company": "Company Full Name",
      "job_title": "Job Title",
      "start_year": 2020,
      "end_year": null,
      "is_current": true,
      "achievements": [
        {
          "text": "Achievement description (concise, professional, value-focused)",
          "tier": 1,
          "has_placeholders": false
        }
      ]
    }
  ]
}`,

  jd_parse_cn: `从职位描述中提取关键技能、职责和要求。输出 JSON: { "skills": [], "keywords": [] }`,
  jd_parse_en: `Extract key skills, responsibilities and requirements from the job description. Output JSON: { "skills": [], "keywords": [] }`,

  achievement_match_cn: `根据JD关键词匹配成就库中最相关的成就。输出 JSON: { "matched_ids": [] }`,
  achievement_match_en: `Match the most relevant achievements from the bank based on JD keywords. Output JSON: { "matched_ids": [] }`,

  achievement_extract_cn: `从 Notion 任务中提取职业成就，量化表达。输出 JSON: { "achievements": [{ "text": "", "tier": 1 }] }`,
  achievement_extract_en: `Extract career achievements from Notion tasks with quantified expressions. Output JSON: { "achievements": [{ "text": "", "tier": 1 }] }`
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
