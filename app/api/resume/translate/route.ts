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
 *   user_id?          string | null
 *   resume_lang       'en' | 'bilingual'
 *   achievements      { id: string; text: string }[]
 *   project_names?    string[]   — unique project names extracted from achievements
 *   personal_info     ResumePersonalInfo
 *   education         ResumeEducation[]
 *   skills            ResumeSkillGroup[]
 *   certifications?   { name: string; issuing_org: string | null }[]
 *   awards?           { title: string; description: string | null; issuing_org: string | null }[]
 *   publications?     { title: string; description: string | null; publication_venue: string | null }[]
 *   spoken_languages? { language_name: string }[]
 *   work_experiences? { id: string; job_title: string; company: string }[]
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      user_id?: string | null
      resume_lang: string
      achievements?: { id: string; text: string }[]
      project_names?: string[]
      personal_info?: Record<string, unknown> | null
      education?: unknown[]
      skills?: unknown[]
      certifications?: unknown[]
      awards?: unknown[]
      publications?: { title: string; description: string | null; publication_venue: string | null }[]
      spoken_languages?: unknown[]
      work_experiences?: { id: string; job_title: string; company: string }[]
    }

    const {
      user_id,
      resume_lang,
      achievements,
      project_names,
      personal_info,
      education,
      skills,
      certifications,
      awards,
      publications,
      spoken_languages,
      work_experiences,
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

    // ── 1. Translate achievement texts + project names ────────────────────────
    if (achievements?.length || project_names?.length) {
      try {
        const prompt = await getPrompt('resume_translate', market)
        const input: Record<string, unknown> = {}
        if (achievements?.length) input.achievements = achievements
        if (project_names?.length) input.project_names = project_names
        const response = await callAI(
          'resume_translate',
          [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(input) }
          ],
          market,
          { timeout: 30000 }
        )
        const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
        const parsed = JSON.parse(cleaned) as {
          translated?: { id: string; text: string }[]
          translated_project_names?: { original: string; translated: string }[]
        }
        if (parsed?.translated?.length) result.translated_achievements = parsed.translated
        if (parsed?.translated_project_names?.length) {
          // Convert to { [original]: translated } map for fast lookup
          const map: Record<string, string> = {}
          for (const item of parsed.translated_project_names) {
            if (item.original && item.translated) map[item.original] = item.translated
          }
          result.translated_project_names = map
        }
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
      (spoken_languages && spoken_languages.length > 0) ||
      (work_experiences && work_experiences.length > 0)

    if (hasAnyProfile) {
      try {
        const prompt = await getPrompt('resume_profile_translate', market)
        // Include publication_venue in publications so AI can translate venue names
        const pubsWithVenue = (publications ?? []).map(p => ({
          title: p.title,
          description: p.description ?? null,
          publication_venue: p.publication_venue ?? null,
        }))
        const input = {
          personal_info: personal_info ?? {},
          education: education ?? [],
          skills: skills ?? [],
          certifications: certifications ?? [],
          awards: awards ?? [],
          publications: pubsWithVenue,
          spoken_languages: spoken_languages ?? [],
          work_experiences: work_experiences ?? [],
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
          certifications?: { name: string; issuing_org?: string | null }[]
          awards?: { title: string; description?: string | null; issuing_org?: string | null }[]
          publications?: { title: string; description?: string | null; publication_venue?: string | null }[]
          spoken_languages?: unknown[]
          work_experiences?: { id: string; job_title?: string; company?: string }[]
        }
        if (parsed?.personal_info) result.translated_personal_info = parsed.personal_info
        if (parsed?.education?.length) result.translated_education = parsed.education
        if (parsed?.skills?.length) result.translated_skills = parsed.skills
        if (parsed?.certifications?.length) result.translated_certifications = parsed.certifications
        if (parsed?.awards?.length) result.translated_awards = parsed.awards
        if (parsed?.publications?.length) result.translated_publications = parsed.publications
        if (parsed?.spoken_languages?.length) result.translated_spoken_languages = parsed.spoken_languages
        if (parsed?.work_experiences?.length) result.translated_work_experiences = parsed.work_experiences
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
