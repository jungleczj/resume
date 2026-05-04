import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Disable Next.js fetch caching — storage binary downloads break with it
export const dynamic = 'force-dynamic'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'
import { extractTextFromFile, extractFirstImageFromPDF, extractFirstImageFromDOCX } from '@/lib/utils/file-parser'
import { detectPII } from '@/lib/utils/detect-pii'
import { logError } from '@/lib/error-logger'
import type { BeautifyOutput, RawStructureOutput, AchievementBeautifyResult } from '@/lib/types/domain'

/** Detect PostgREST / Postgres schema-cache errors so we can retry with fewer columns */
function isSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST204') return true
  if (err.code === '42703') return true
  const msg = err.message?.toLowerCase() ?? ''
  return msg.includes('schema cache') || msg.includes('could not find') || msg.includes('does not exist')
}

/** Compute a simple ai_score (0–1) without any AI call */
function computeAiScore(text: string): number {
  // Quantification (40% weight): has numbers, %, currency, scale words
  const hasNum = /\d/.test(text)
  const hasPct = /%/.test(text)
  const hasMoney = /[$¥€£]\s*\d|\d\s*[万千亿]/.test(text)
  const q = Math.min(1.0, (hasNum ? 0.5 : 0) + (hasPct ? 0.3 : 0) + (hasMoney ? 0.2 : 0))
  // Completeness (35% weight): word/char count heuristic
  const words = text.trim().split(/\s+/).length
  const c = words >= 10 ? 0.9 : words >= 6 ? 0.7 : words >= 3 ? 0.5 : 0.3
  // Relevance (25% weight): neutral 0.5 (no embedding yet)
  return Math.round((0.4 * q + 0.35 * c + 0.25 * 0.5) * 100) / 100
}

/** Map AI free-text skill category to DB enum */
function mapSkillCategory(cat: string | null | undefined): string {
  if (!cat) return 'other'
  const lower = cat.toLowerCase()
  if (lower.includes('programming') || lower.includes('language') || lower.includes('编程') || lower.includes('语言')) return 'programming_language'
  if (lower.includes('framework') || lower.includes('库') || lower.includes('框架')) return 'framework'
  if (lower.includes('tool') || lower.includes('工具') || lower.includes('platform')) return 'tool'
  if (lower.includes('soft') || lower.includes('软技能') || lower.includes('communication') || lower.includes('leadership')) return 'soft_skill'
  if (lower.includes('domain') || lower.includes('business') || lower.includes('行业')) return 'domain_knowledge'
  return 'other'
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.INTERNAL_API_SECRET
  const internalSecret = req.headers.get('x-internal-secret')
  if (configuredSecret) {
    if (!internalSecret || internalSecret !== configuredSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    const host = req.headers.get('host') ?? ''
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    if (!isLocal) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let upload_id: string | undefined
  try {
    const body = await req.json()
    const { file_path, anonymous_id, user_id } = body
    upload_id = body.upload_id

    if (!upload_id || !file_path) {
      return NextResponse.json(
        { error: 'Missing upload_id or file_path' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    await supabase
      .from('resume_uploads')
      .update({ parse_status: 'processing' })
      .eq('id', upload_id)

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(file_path)

    if (downloadError || !fileData) {
      throw new Error(`Cannot download file: ${downloadError?.message}`)
    }

    // Read into Buffer once — used for both text extraction and image extraction
    const fileBuffer = Buffer.from(await fileData.arrayBuffer())
    const fileExt = file_path.split('.').pop()?.toLowerCase()

    const rawText = await extractTextFromFile(new Blob([fileBuffer]), file_path)
    console.log('[parse] text extracted, length:', rawText.length)

    // Detect PII in raw text and persist to uploaded_files row
    const { detected: piiDetected } = detectPII(rawText)
    console.log('[parse] pii_detected:', piiDetected)
    await supabase
      .from('resume_uploads')
      .update({ pii_detected: piiDetected })
      .eq('id', upload_id)

    // Extract profile photo via fast binary scan (JPEG/PNG marker scan — no DOM/mammoth pass)
    let photoExtractedPath: string | null = null
    const uploadPhotoToStorage = async (
      photo: { data: Buffer; contentType: string }
    ): Promise<string | null> => {
      const ext = photo.contentType.includes('png') ? 'png' : 'jpg'
      const photoPath = `extracted/${anonymous_id ?? upload_id}/profile.${ext}`
      console.log('[parse] uploading photo to storage:', photoPath, photo.data.length, 'bytes')
      const { error: photoUploadError } = await supabase.storage
        .from('photos')
        .upload(photoPath, photo.data, { contentType: photo.contentType, upsert: true })
      if (photoUploadError) {
        console.error('[parse] photo upload failed:', photoUploadError.message, photoUploadError)
        return null
      }
      // Use a long-lived signed URL (10yr ≈ 315,360,000s) — works for both
      // public and private buckets. Once migration makes bucket public, the
      // public URL will also work, but signed URLs are always safe.
      const { data: signed, error: signError } = await supabase.storage
        .from('photos')
        .createSignedUrl(photoPath, 315360000)
      if (signError || !signed?.signedUrl) {
        // Last fallback: public URL (works if bucket is public)
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(photoPath)
        const url = urlData?.publicUrl ?? null
        console.log('[parse] photo uploaded (public url fallback):', url)
        return url
      }
      console.log('[parse] photo uploaded OK, signed url length:', signed.signedUrl.length)
      return signed.signedUrl
    }

    console.log('[parse] scanning for embedded photo, buffer size:', fileBuffer.length)
    const photo = fileExt === 'pdf'
      ? await extractFirstImageFromPDF(fileBuffer)
      : await extractFirstImageFromDOCX(fileBuffer)
    if (photo) {
      photoExtractedPath = await uploadPhotoToStorage(photo)
    } else {
      console.log('[parse] no photo found in file')
    }

    let market: 'cn' | 'en' = 'cn'
    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user_id)
        .single()
      if (profile?.payment_market === 'en_paid') market = 'en'
    }

    // Detect resume content language independently of user's payment market.
    // CJK character ratio > 15% → treat as Chinese resume; otherwise English.
    const cjkMatches = rawText.match(/[一-鿿㐀-䶿＀-￯]/g) ?? []
    const nonSpaceLen = rawText.replace(/\s/g, '').length
    const contentLang: 'cn' | 'en' =
      nonSpaceLen > 50 && cjkMatches.length / nonSpaceLen > 0.15 ? 'cn' : 'en'
    console.log('[parse] contentLang:', contentLang, '(cjk ratio:', (cjkMatches.length / nonSpaceLen).toFixed(3), ')')

    // ── Call 1: Verbatim structure extraction ─────────────────────────────────
    const structurePrompt = await getPrompt('resume_structure_extract', contentLang)
    console.log('[parse] Call 1 — structure extract, contentLang:', contentLang, 'prompt length:', structurePrompt.length)

    const structureResponse = await callAI(
      'resume_structure_extract',
      [
        { role: 'system', content: structurePrompt },
        { role: 'user', content: rawText }
      ],
      market
    )
    console.log('[parse] Call 1 responded, length:', structureResponse.length)

    const structureCleaned = structureResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const rawStructure: RawStructureOutput = JSON.parse(structureCleaned)
    console.log('[parse] structure parsed, experiences:', rawStructure?.experiences?.length)

    // ── Flatten all bullets with a global index ───────────────────────────────
    interface BulletEntry {
      expIdx: number
      projIdx: number
      bulletIdx: number
      globalIdx: number
      raw: string
      project_name: string | null
      project_member_role: string | null
    }
    const bulletMap: BulletEntry[] = []
    let globalIdx = 0
    for (let ei = 0; ei < (rawStructure.experiences ?? []).length; ei++) {
      const projects = rawStructure.experiences[ei].projects ?? []
      for (let pi = 0; pi < projects.length; pi++) {
        const proj = projects[pi]
        const bullets = proj.raw_bullets ?? []
        for (let bi = 0; bi < bullets.length; bi++) {
          bulletMap.push({
            expIdx: ei,
            projIdx: pi,
            bulletIdx: bi,
            globalIdx,
            raw: bullets[bi],
            project_name: proj.project_name ?? null,
            project_member_role: proj.project_member_role ?? null,
          })
          globalIdx++
        }
      }
    }

    // ── Call 2: Achievement beautification ───────────────────────────────────
    const beautifyPrompt = await getPrompt('resume_achievement_beautify', contentLang)
    console.log('[parse] Call 2 — achievement beautify, bullets:', bulletMap.length, 'contentLang:', contentLang, 'prompt length:', beautifyPrompt.length)

    const inputPayload = bulletMap.map(b => ({ index: b.globalIdx, raw: b.raw }))
    const beautifyResponse = await callAI(
      'resume_achievement_beautify',
      [
        { role: 'system', content: beautifyPrompt },
        { role: 'user', content: JSON.stringify(inputPayload) }
      ],
      market
    )
    console.log('[parse] Call 2 responded, length:', beautifyResponse.length)

    const beautifyCleaned = beautifyResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const beautifiedResults: AchievementBeautifyResult[] = JSON.parse(beautifyCleaned)
    console.log('[parse] beautified bullets:', beautifiedResults.length)

    // ── Build the final BeautifyOutput from both calls ────────────────────────
    const beautifiedByIdx = new Map<number, AchievementBeautifyResult>()
    for (const r of beautifiedResults) beautifiedByIdx.set(r.index, r)

    const output: BeautifyOutput = {
      personal_info: rawStructure.personal_info,
      education: rawStructure.education ?? [],
      skills: rawStructure.skills ?? [],
      experiences: (rawStructure.experiences ?? []).map((exp, ei) => ({
        company: exp.company,
        job_title: exp.job_title,
        start_year: exp.start_year,
        start_month: exp.start_month,
        end_year: exp.end_year,
        end_month: exp.end_month,
        is_current: exp.is_current,
        achievements: (exp.projects ?? []).flatMap((proj, pi) =>
          (proj.raw_bullets ?? []).map((raw, bi) => {
            const entry = bulletMap.find(b => b.expIdx === ei && b.projIdx === pi && b.bulletIdx === bi)
            const result = entry ? beautifiedByIdx.get(entry.globalIdx) : undefined
            return result
              ? {
                  text: result.text,
                  tier: result.tier,
                  has_placeholders: result.has_placeholders,
                  project_name: proj.project_name ?? null,
                  project_member_role: proj.project_member_role ?? null,
                }
              : {
                  text: raw,
                  tier: 3 as const,
                  has_placeholders: false,
                  project_name: proj.project_name ?? null,
                  project_member_role: proj.project_member_role ?? null,
                }
          })
        )
      }))
    }
    console.log('[parse] merged output, experiences:', output.experiences.length, 'education:', output.education.length, 'skills:', output.skills.length)

    // ── Clear stale records before inserting new ones ────────────────────────
    // Both anonymous and authenticated users: always replace, never append.
    if (user_id) {
      await supabase.from('work_experiences').delete().eq('user_id', user_id)
      await Promise.all([
        supabase.from('education').delete().eq('user_id', user_id),
        supabase.from('user_skills').delete().eq('user_id', user_id),
        supabase.from('certifications').delete().eq('user_id', user_id),
        supabase.from('spoken_languages').delete().eq('user_id', user_id),
        supabase.from('awards_honors').delete().eq('user_id', user_id),
        supabase.from('publications').delete().eq('user_id', user_id),
      ])
    } else if (anonymous_id) {
      await supabase.from('work_experiences').delete().eq('anonymous_id', anonymous_id)
      await Promise.all([
        supabase.from('education').delete().eq('anonymous_id', anonymous_id),
        supabase.from('user_skills').delete().eq('anonymous_id', anonymous_id),
        supabase.from('certifications').delete().eq('anonymous_id', anonymous_id),
        supabase.from('spoken_languages').delete().eq('anonymous_id', anonymous_id),
        supabase.from('awards_honors').delete().eq('anonymous_id', anonymous_id),
        supabase.from('publications').delete().eq('anonymous_id', anonymous_id),
      ])
    }

    let tier1 = 0, tier2 = 0, tier3 = 0

    for (let ei = 0; ei < (output.experiences ?? []).length; ei++) {
      const exp = output.experiences[ei]
      const rawExp = rawStructure.experiences[ei]
      // Flatten raw bullets in same order as achievements (for original_text)
      const rawBullets = (rawExp?.projects ?? []).flatMap(p => p.raw_bullets ?? [])

      // Post-process: if AI returned end_year but forgot to set is_current=false, fix it
      const hasEndYear = exp.end_year != null
      const isCurrentFinal = hasEndYear ? false : (exp.is_current ?? false)
      const endYearFinal = isCurrentFinal ? null : (exp.end_year ?? null)

      // Build original tenure string preserving month precision (e.g., "2020.03 - 2023.06")
      const fmtDate = (year: number | null, month: number | null): string => {
        if (!year) return ''
        if (!month) return String(year)
        return `${year}.${String(month).padStart(2, '0')}`
      }
      let originalTenure: string | null = null
      if (exp.start_year) {
        const startStr = fmtDate(exp.start_year, exp.start_month ?? null)
        const endStr = isCurrentFinal
          ? 'Present'
          : fmtDate(exp.end_year ?? null, exp.end_month ?? null)
        originalTenure = startStr + (endStr ? ` - ${endStr}` : '')
      }

      const fullExpPayload = {
        user_id: user_id ?? null,
        anonymous_id,
        company: exp.company ?? '',
        job_title: exp.job_title ?? '',
        start_date: exp.start_year ? `${exp.start_year}-01-01` : null,
        end_date: endYearFinal ? `${endYearFinal}-01-01` : null,
        is_current: isCurrentFinal,
        original_tenure: originalTenure,
        sort_order: ei,
        // Fortune 500 fields — month precision + enrichment
        start_month: rawExp?.start_month ?? null,
        end_month: isCurrentFinal ? null : (rawExp?.end_month ?? null),
        employment_type: rawExp?.employment_type ?? null,
        company_size: rawExp?.company_size ?? null,
        team_size: rawExp?.team_size ?? null,
        direct_reports: rawExp?.direct_reports ?? null,
        budget_managed: rawExp?.budget_managed ?? null,
      }

      let expRecord: { id: string } | null = null
      let expError: { code?: string; message?: string } | null = null;

      ({ data: expRecord, error: expError } = await supabase
        .from('work_experiences')
        .insert(fullExpPayload)
        .select('id')
        .single())

      if (expError && isSchemaError(expError)) {
        console.warn('[parse] work_experiences full insert schema error, retrying with core columns:', expError.message)
        const coreExpPayload = {
          user_id: user_id ?? null,
          anonymous_id,
          company: exp.company ?? '',
          job_title: exp.job_title ?? '',
          is_current: isCurrentFinal,
          sort_order: ei,
        };
        ({ data: expRecord, error: expError } = await supabase
          .from('work_experiences')
          .insert(coreExpPayload)
          .select('id')
          .single())
      }

      if (expError || !expRecord) {
        console.error('[parse] work_experience insert failed:', expError?.message, expError?.code)
        continue
      }

      const achievementsToInsert = exp.achievements.map((a, ai) => ({
        experience_id: expRecord.id,
        user_id: user_id ?? null,
        anonymous_id: anonymous_id ?? null,
        text: a.text,
        status: 'confirmed',
        tier: a.tier,
        has_placeholders: a.has_placeholders,
        source: 'upload' as const,
        ai_score: computeAiScore(a.text),
        project_name: a.project_name ?? null,
        project_member_role: a.project_member_role ?? null,
        original_text: rawBullets[ai] ?? null,
      }))

      let { error: achError } = await supabase.from('achievements').insert(achievementsToInsert)
      if (achError && isSchemaError(achError)) {
        console.warn('[parse] achievements full insert schema error, retrying with core columns:', achError.message)
        const coreAchievements = exp.achievements.map((a) => ({
          experience_id: expRecord!.id,
          user_id: user_id ?? null,
          anonymous_id: anonymous_id ?? null,
          text: a.text,
          status: 'confirmed',
          tier: a.tier,
          has_placeholders: a.has_placeholders,
          source: 'upload' as const,
          ai_score: computeAiScore(a.text),
        }));
        ({ error: achError } = await supabase.from('achievements').insert(coreAchievements))
      }
      if (achError) console.error('[parse] achievements insert failed:', achError.message, achError.code)

      exp.achievements.forEach((a) => {
        if (a.tier === 1) tier1++
        else if (a.tier === 2) tier2++
        else tier3++
      })
    }

    // ── Insert Fortune 500 supplemental tables ────────────────────────────────
    const ownerId = { user_id: user_id ?? null, anonymous_id: anonymous_id ?? null }

    // Education
    const eduRows = rawStructure.education ?? []
    if (eduRows.length > 0) {
      const { error: eduErr } = await supabase.from('education').insert(
        eduRows.map((edu, idx) => ({
          ...ownerId,
          institution_name: edu.school,
          field_of_study: edu.major ?? null,
          minor_field: edu.minor_subject ?? null,
          start_year: edu.start_year ?? null,
          end_year: edu.end_year ?? null,
          is_current: false,
          gpa_score: edu.gpa_score ? (parseFloat(edu.gpa_score) || null) : null,
          gpa_scale: edu.gpa_scale ? (parseFloat(edu.gpa_scale) || null) : null,
          class_rank_text: edu.class_rank_text ?? null,
          academic_honors: edu.academic_honors ?? null,
          thesis_title: edu.thesis_title ?? null,
          activities: edu.activities ?? null,
          study_abroad: edu.study_abroad ?? null,
          sort_order: idx,
        }))
      )
      if (eduErr) console.error('[parse] education insert failed:', eduErr.message)
    }

    // Skills — flatten ResumeSkillGroup[] into individual user_skills rows
    const skillRows = (rawStructure.skills ?? []).flatMap((group, gi) =>
      (group.items ?? []).map((skillName, si) => ({
        ...ownerId,
        skill_name: skillName,
        category: mapSkillCategory(group.category),
        proficiency_level: 'intermediate' as const,
        is_featured: false,
        sort_order: gi * 100 + si,
      }))
    )
    if (skillRows.length > 0) {
      const { error: skillErr } = await supabase.from('user_skills').insert(skillRows)
      if (skillErr) console.error('[parse] user_skills insert failed:', skillErr.message)
    }

    // Certifications
    const certRows = rawStructure.certifications ?? []
    if (certRows.length > 0) {
      const { error: certErr } = await supabase.from('certifications').insert(
        certRows.map((cert, idx) => ({
          ...ownerId,
          name: cert.name,
          issuing_org: cert.issuing_org ?? null,
          issue_year: cert.issue_year ?? null,
          issue_month: cert.issue_month ?? null,
          expiry_year: cert.expiry_year ?? null,
          is_current: true,
          credential_id: cert.credential_id ?? null,
          sort_order: idx,
        }))
      )
      if (certErr) console.error('[parse] certifications insert failed:', certErr.message)
    }

    // Spoken languages
    const langRows = rawStructure.spoken_languages ?? []
    if (langRows.length > 0) {
      const { error: langErr } = await supabase.from('spoken_languages').insert(
        langRows.map((lang, idx) => ({
          ...ownerId,
          language_name: lang.language_name,
          proficiency: lang.proficiency ?? 'professional_working',
          is_native: lang.is_native ?? false,
          sort_order: idx,
        }))
      )
      if (langErr) console.error('[parse] spoken_languages insert failed:', langErr.message)
    }

    // Awards
    const awardRows = rawStructure.awards ?? []
    if (awardRows.length > 0) {
      const { error: awardErr } = await supabase.from('awards_honors').insert(
        awardRows.map((award, idx) => ({
          ...ownerId,
          title: award.title,
          issuing_org: award.issuing_org ?? null,
          award_year: award.award_year ?? null,
          description: award.description ?? null,
          sort_order: idx,
        }))
      )
      if (awardErr) console.error('[parse] awards_honors insert failed:', awardErr.message)
    }

    // Publications
    const pubRows = rawStructure.publications ?? []
    if (pubRows.length > 0) {
      const { error: pubErr } = await supabase.from('publications').insert(
        pubRows.map((pub, idx) => ({
          ...ownerId,
          title: pub.title,
          pub_type: pub.pub_type ?? 'other',
          authors: pub.authors ?? null,
          author_position: pub.author_position ?? null,
          publication_venue: pub.publication_venue ?? null,
          pub_year: pub.pub_year ?? null,
          pub_month: pub.pub_month ?? null,
          doi: pub.doi ?? null,
          patent_number: pub.patent_number ?? null,
          url: pub.url ?? null,
          status: pub.status ?? 'published',
          description: pub.description ?? null,
          sort_order: idx,
        }))
      )
      if (pubErr) console.error('[parse] publications insert failed:', pubErr.message)
    }

    // Save everything to resume_uploads
    await supabase
      .from('resume_uploads')
      .update({
        raw_text: rawText,
        parse_status: 'completed',
        photo_extracted_path: photoExtractedPath,
        parsed_data: {
          content_lang: contentLang,
          personal_info: output.personal_info ?? null,
          education: output.education ?? [],
          skills: output.skills ?? [],
          certifications: certRows,
          spoken_languages: langRows,
          awards: awardRows,
          publications: pubRows,
        }
      })
      .eq('id', upload_id)

    await trackEvent('f1_parse_completed', {
      anonymous_id,
      tier1_count: tier1,
      tier2_count: tier2,
      tier3_count: tier3,
      market,
      has_photo: !!photoExtractedPath
    })

    return NextResponse.json({ success: true, data: { tier1, tier2, tier3 } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed'
    console.error('[parse] ERROR:', message, error instanceof Error ? error.stack : '')

    try {
      const supabase = createServiceClient()
      if (upload_id) {
        await supabase
          .from('resume_uploads')
          .update({ parse_status: 'failed', parse_error: message })
          .eq('id', upload_id)
      }
    } catch { /* ignore */ }

    await logError({ context: 'parse', error, uploadId: upload_id, meta: { message } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
