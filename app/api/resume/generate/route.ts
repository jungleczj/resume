import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const { jd_text, anonymous_id, user_id, resume_lang } = await req.json()

    if (!anonymous_id && !user_id) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
    }

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

    if (allAchievements.length === 0) {
      return NextResponse.json({
        success: true,
        data: { editor_json: buildEmptyResumeJson(resume_lang) }
      })
    }

    // If JD provided, use AI to match and rank achievements
    let selectedAchievements = allAchievements
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
              achievements: allAchievements.map((a) => ({ id: a.id, text: a.text, tier: a.tier }))
            })
          }
        ],
        market
      )

      try {
        const { matched_ids } = JSON.parse(aiResponse) as { matched_ids: string[] }
        if (matched_ids?.length > 0) {
          const matchedSet = new Set(matched_ids)
          selectedAchievements = allAchievements.filter((a) => matchedSet.has(a.id as string))
          // Fallback: if AI matched nothing valid, keep all
          if (selectedAchievements.length === 0) selectedAchievements = allAchievements
        }
      } catch {
        // Keep all achievements if AI parse fails
      }
    }

    const editorJson = buildResumeJson(experiences ?? [], selectedAchievements, resume_lang)

    await trackEvent('resume_generated', {
      anonymous_id,
      has_jd: !!jd_text?.trim(),
      achievement_count: selectedAchievements.length,
      generation_time_ms: Date.now() - startTime,
      market
    })

    return NextResponse.json({ success: true, data: { editor_json: editorJson } })
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
          experience_id: exp.id
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
