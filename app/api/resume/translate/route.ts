import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'

/**
 * POST /api/resume/translate
 *
 * Lightweight translation-only endpoint — does NOT regenerate the resume.
 * Used when the user toggles resume_lang without clicking "Generate".
 *
 * Body:
 *   user_id?         string | null
 *   resume_lang      'en' | 'bilingual'
 *   achievements     { id: string; text: string }[]
 *   personal_info    ResumePersonalInfo
 *   education        ResumeEducation[]
 *   skills           ResumeSkillGroup[]
 *   certifications?  { name: string; issuing_org: string | null }[]
 *   awards?          { title: string; description: string | null }[]
 *   publications?    { title: string; description: string | null }[]
 *   spoken_languages?  { language_name: string }[]
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      user_id?: string | null
      resume_lang: string
      achievements?: { id: string; text: string }[]
      personal_info?: Record<string, unknown> | null
      education?: unknown[]
      skills?: unknown[]
      certifications?: unknown[]
      awards?: unknown[]
      publications?: unknown[]
      spoken_languages?: unknown[]
    }

    const {
      user_id,
      resume_lang,
      achievements,
      personal_info,
      education,
      skills,
      certifications,
      awards,
      publications,
      spoken_languages,
    } = body

    if (!resume_lang || resume_lang === 'zh') {
      return NextResponse.json({ success: true, data: {} })
    }

    // Determine market from profile
    let market: 'cn' | 'en' = 'cn'
    if (user_id) {
      const supabase = await createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user_id)
        .single()
      if (profile?.payment_market === 'en_paid') market = 'en'
    }

    const result: Record<string, unknown> = {}

    // ── 1. Translate achievement texts ────────────────────────────────────────
    if (achievements?.length) {
      try {
        const prompt = await getPrompt('resume_translate', market)
        const response = await callAI(
          'resume_translate',
          [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(achievements) }
          ],
          market,
          { timeout: 30000 }
        )
        const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(cleaned) as { translated: { id: string; text: string }[] }
        if (parsed?.translated?.length) result.translated_achievements = parsed.translated
      } catch {
        // Silently fallback — original text will be displayed
      }
    }

    // ── 2. Translate profile + extra sections ─────────────────────────────────
    const hasAnyProfile =
      personal_info ||
      (education && education.length > 0) ||
      (skills && skills.length > 0) ||
      (certifications && certifications.length > 0) ||
      (awards && awards.length > 0) ||
      (publications && publications.length > 0) ||
      (spoken_languages && spoken_languages.length > 0)

    if (hasAnyProfile) {
      try {
        const prompt = await getPrompt('resume_profile_translate', market)
        const input = {
          personal_info: personal_info ?? {},
          education: education ?? [],
          skills: skills ?? [],
          certifications: certifications ?? [],
          awards: awards ?? [],
          publications: publications ?? [],
          spoken_languages: spoken_languages ?? [],
        }
        const response = await callAI(
          'resume_profile_translate',
          [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(input) }
          ],
          market,
          { timeout: 30000 }
        )
        const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(cleaned) as {
          personal_info?: Record<string, unknown>
          education?: unknown[]
          skills?: unknown[]
          certifications?: unknown[]
          awards?: unknown[]
          publications?: unknown[]
          spoken_languages?: unknown[]
        }
        if (parsed?.personal_info) result.translated_personal_info = parsed.personal_info
        if (parsed?.education?.length) result.translated_education = parsed.education
        if (parsed?.skills?.length) result.translated_skills = parsed.skills
        if (parsed?.certifications?.length) result.translated_certifications = parsed.certifications
        if (parsed?.awards?.length) result.translated_awards = parsed.awards
        if (parsed?.publications?.length) result.translated_publications = parsed.publications
        if (parsed?.spoken_languages?.length) result.translated_spoken_languages = parsed.spoken_languages
      } catch {
        // Silently fallback — original data will be displayed
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
