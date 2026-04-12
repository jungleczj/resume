import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const { jd_text, anonymous_id, user_id, resume_lang, personal_info, education, skills } = await req.json()

    if (!anonymous_id && !user_id) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
    }

    // Rate limit: 20 generate calls per user/anonymous_id per hour
    const rlIdentifier = user_id ?? anonymous_id ?? req.headers.get('x-forwarded-for') ?? 'local'
    const rlKey = `generate:${rlIdentifier}`
    const { allowed, remaining, resetAt } = await checkRateLimit(rlKey, 20, 3600)
    if (!allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(resetAt),
            'Retry-After': String(resetAt - Math.floor(Date.now() / 1000))
          }
        }
      )
    }
    void remaining // suppress unused-var warning

    const supabase = await createClient()

    // Determine market from profile
    let market: 'cn' | 'en' = 'cn'
    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user_id)
        .single()
      if (profile?.payment_market === 'en_paid') market = 'en'
    }

    // Load confirmed achievements
    const query = supabase
      .from('work_experiences')
      .select('*, achievements!inner(*)')
      .eq('achievements.status', 'confirmed')
      .order('sort_order', { ascending: true })

    const { data: experiences, error: expError } = user_id
      ? await query.eq('user_id', user_id)
      : await query.eq('anonymous_id', anonymous_id)

    if (expError) throw new Error(expError.message)

    const allAchievements = (experiences ?? []).flatMap((exp) =>
      (exp.achievements ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        text: a.text,
        tier: a.tier,
        company: exp.company,
        job_title: exp.job_title,
        experience_id: exp.id
      }))
    )

    // ── 3-tier degradation strategy ───────────────────────────────────────────
    const confirmedCount = allAchievements.length
    let strategy: 'normal' | 'mixed' | 'fallback' = 'normal'
    let warningMessage: string | null = null
    let supplementDrafts: typeof allAchievements = []

    if (confirmedCount === 0) {
      strategy = 'fallback'
      warningMessage = '正在使用草稿预览，确认成就后可生成正式版本'
      // Load draft achievements ranked by ai_score
      const draftQuery = supabase
        .from('work_experiences')
        .select('*, achievements!inner(*)')
        .eq('achievements.status', 'draft')
        .order('ai_score', { ascending: false })
        .limit(6)
      const { data: draftExps } = user_id
        ? await draftQuery.eq('user_id', user_id)
        : await draftQuery.eq('anonymous_id', anonymous_id)
      supplementDrafts = (draftExps ?? []).flatMap((exp: Record<string, unknown>) =>
        ((exp.achievements ?? []) as Record<string, unknown>[]).map((a) => ({
          id: a.id,
          text: a.text,
          tier: a.tier,
          company: exp.company,
          job_title: exp.job_title,
          experience_id: exp.id
        }))
      ).slice(0, 6)
    } else if (confirmedCount <= 2) {
      strategy = 'mixed'
      warningMessage = '成就较少，已补充草稿内容'
      // Load draft achievements with ai_score >= 0.6 to supplement confirmed ones
      const draftSuppQuery = supabase
        .from('work_experiences')
        .select('*, achievements!inner(*)')
        .eq('achievements.status', 'draft')
        .gte('achievements.ai_score', 0.6)
        .order('sort_order', { ascending: true })
      const { data: draftSuppExps } = user_id
        ? await draftSuppQuery.eq('user_id', user_id)
        : await draftSuppQuery.eq('anonymous_id', anonymous_id)
      supplementDrafts = (draftSuppExps ?? []).flatMap((exp: Record<string, unknown>) =>
        ((exp.achievements ?? []) as Record<string, unknown>[]).map((a) => ({
          id: a.id,
          text: a.text,
          tier: a.tier,
          company: exp.company,
          job_title: exp.job_title,
          experience_id: exp.id
        }))
      )
    }

    // Resolve the working achievement set based on strategy
    let selectedAchievements: typeof allAchievements
    if (strategy === 'fallback') {
      if (supplementDrafts.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            editor_json: buildEmptyResumeJson(resume_lang),
            strategy,
            warning_message: warningMessage,
          }
        })
      }
      selectedAchievements = supplementDrafts
    } else if (strategy === 'mixed') {
      // Merge confirmed + high-scoring drafts, deduplicated
      const merged = [...allAchievements]
      for (const d of supplementDrafts) {
        if (!merged.some((a) => a.id === d.id)) merged.push(d)
      }
      selectedAchievements = merged
    } else {
      // normal: use all confirmed achievements
      selectedAchievements = allAchievements
    }
    // If JD provided, use AI to match and rank achievements against the resolved set
    if (jd_text?.trim()) {
      const prompt = await getPrompt('achievement_match', market)
      const aiResponse = await callAI(
        'achievement_match',
        [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: JSON.stringify({
              jd: jd_text.slice(0, 5000),
              achievements: selectedAchievements.map((a) => ({ id: a.id, text: a.text, tier: a.tier }))
            })
          }
        ],
        market
      )

      try {
        const { matched_ids } = JSON.parse(aiResponse) as { matched_ids: string[] }
        if (matched_ids?.length > 0) {
          const matchedSet = new Set(matched_ids)
          const filtered = selectedAchievements.filter((a) => matchedSet.has(a.id as string))
          // Fallback: if AI matched nothing valid, keep current selected set
          if (filtered.length > 0) selectedAchievements = filtered
        }
      } catch {
        // Keep current selectedAchievements if AI parse fails
      }
    }

    const editorJson = buildResumeJson(experiences ?? [], selectedAchievements, resume_lang)

    // ── Translate achievement texts when lang is 'en' or 'bilingual' ──────────
    let translated_achievements: { id: string; text: string }[] | null = null
    let translated_personal_info: Record<string, unknown> | null = null
    let translated_education: unknown[] | null = null
    let translated_skills: unknown[] | null = null

    if (resume_lang === 'en' || resume_lang === 'bilingual') {
      // Translate achievement texts
      try {
        const translatePrompt = await getPrompt('resume_translate', market)
        const translateInput = selectedAchievements.map((a) => ({ id: a.id, text: a.text }))
        const translateResponse = await callAI(
          'resume_translate',
          [
            { role: 'system', content: translatePrompt },
            { role: 'user', content: JSON.stringify(translateInput) }
          ],
          market,
          { timeout: 30000 }
        )
        const cleaned = translateResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(cleaned) as { translated: { id: string; text: string }[] }
        if (parsed?.translated?.length) translated_achievements = parsed.translated
      } catch {
        // Translation failed — silently fall back to original text
      }

      // Translate profile (personal_info, education, skills) if provided
      if (personal_info || (education && education.length > 0) || (skills && skills.length > 0)) {
        try {
          const profileTranslatePrompt = await getPrompt('resume_profile_translate', market)
          const profileInput = {
            personal_info: personal_info ?? {},
            education: education ?? [],
            skills: skills ?? [],
          }
          const profileResponse = await callAI(
            'resume_profile_translate',
            [
              { role: 'system', content: profileTranslatePrompt },
              { role: 'user', content: JSON.stringify(profileInput) }
            ],
            market,
            { timeout: 25000 }
          )
          const pCleaned = profileResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
          const pParsed = JSON.parse(pCleaned) as {
            personal_info?: Record<string, unknown>
            education?: unknown[]
            skills?: unknown[]
          }
          if (pParsed?.personal_info) translated_personal_info = pParsed.personal_info
          if (pParsed?.education?.length) translated_education = pParsed.education
          if (pParsed?.skills?.length) translated_skills = pParsed.skills
        } catch {
          // Profile translation failed — silently skip
        }
      }
    }

    // ── AI Summary generation ──────────────────────────────────────────────────
    let generated_summary: string | null = null
    try {
      const summaryPrompt = await getPrompt('resume_summary_generate', market)
      // Build a concise input for the summary model
      const topAchievements = selectedAchievements
        .filter((a) => (a.tier as number) <= 2)
        .slice(0, 10)
        .map((a) => `- ${a.text} (${a.company}, ${a.job_title})`)
        .join('\n')
      const educationLines = (education ?? [])
        .slice(0, 2)
        .map((e: Record<string, unknown>) => `${e.school ?? ''} ${e.degree ?? ''} ${e.major ?? ''}`.trim())
        .join('; ')
      const skillLines = (skills ?? [])
        .slice(0, 4)
        .map((s: Record<string, unknown>) => `${s.category}: ${(s.items as string[] ?? []).slice(0, 5).join(', ')}`)
        .join(' | ')
      const summaryInput = [
        personal_info?.name ? `姓名/Name: ${personal_info.name}` : '',
        educationLines ? `教育/Education: ${educationLines}` : '',
        skillLines ? `技能/Skills: ${skillLines}` : '',
        topAchievements ? `代表成就/Achievements:\n${topAchievements}` : ''
      ].filter(Boolean).join('\n')

      const summaryRaw = await callAI(
        'resume_summary_generate',
        [
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: summaryInput }
        ],
        market,
        { timeout: 20000 }
      )
      generated_summary = summaryRaw.trim().replace(/^["']|["']$/g, '')
    } catch {
      // Summary generation failed — return null, frontend keeps existing summary
    }

    await trackEvent('resume_generated', {
      anonymous_id,
      has_jd: !!jd_text?.trim(),
      achievement_count: selectedAchievements.length,
      generation_time_ms: Date.now() - startTime,
      market
    })

    return NextResponse.json({
      success: true,
      data: {
        editor_json: editorJson,
        ...(translated_achievements ? { translated_achievements } : {}),
        ...(translated_personal_info ? { translated_personal_info } : {}),
        ...(translated_education ? { translated_education } : {}),
        ...(translated_skills ? { translated_skills } : {}),
        ...(generated_summary ? { generated_summary } : {}),
        strategy,
        warning_message: warningMessage,
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildResumeJson(
  experiences: Record<string, unknown>[],
  selectedAchievements: Record<string, unknown>[],
  lang: string
) {
  const selectedByExp = new Map<string, Record<string, unknown>[]>()
  for (const a of selectedAchievements) {
    const expId = a.experience_id as string
    if (!selectedByExp.has(expId)) selectedByExp.set(expId, [])
    selectedByExp.get(expId)!.push(a)
  }

  return {
    type: 'doc',
    content: experiences
      .filter((exp) => selectedByExp.has(exp.id as string))
      .map((exp) => ({
        type: 'experience',
        attrs: {
          company: exp.company,
          job_title: exp.job_title,
          experience_id: exp.id,
          // Preserve original tenure format
          original_tenure: (exp as Record<string, unknown>).original_tenure as string | null ?? null,
          start_year: (exp as Record<string, unknown>).start_year as number | null ?? null,
          end_year: (exp as Record<string, unknown>).end_year as number | null ?? null,
          is_current: (exp as Record<string, unknown>).is_current as boolean ?? false
        },
        content: (selectedByExp.get(exp.id as string) ?? []).map((a) => ({
          type: 'achievement',
          attrs: {
            id: a.id,
            tier: a.tier,
            has_placeholders: a.has_placeholders ?? false
          },
          content: [{ type: 'text', text: a.text }]
        }))
      })),
    meta: { lang, generated_at: new Date().toISOString() }
  }
}

function buildEmptyResumeJson(lang: string) {
  return {
    type: 'doc',
    content: [],
    meta: { lang, generated_at: new Date().toISOString() }
  }
}
