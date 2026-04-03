import { createClient } from '@/lib/supabase/server'
import type { AITask } from './types/domain'

// Local fallback prompts (used when Supabase is unavailable)
const FALLBACK_PROMPTS: Partial<Record<`${AITask}_${'cn' | 'en'}`, string>> = {
  resume_beautify_cn: `你是资深简历优化专家。分析简历并提取工作经历和成就，按三档分级：
Tier 1: 量化成就（含具体数字）
Tier 2: 有占位符的成就（如"提升X%"）
Tier 3: 主观描述

输出 JSON: { "experiences": [{ "company": "", "job_title": "", "achievements": [{ "text": "", "tier": 1, "has_placeholders": false }] }] }`,

  resume_beautify_en: `You are a senior resume optimization expert. Analyze the resume and extract work experiences and achievements, classified into three tiers:
Tier 1: Quantified achievements (with specific numbers)
Tier 2: Achievements with placeholders (e.g., "improved by X%")
Tier 3: Subjective descriptions

Output JSON: { "experiences": [{ "company": "", "job_title": "", "achievements": [{ "text": "", "tier": 1, "has_placeholders": false }] }] }`,

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
