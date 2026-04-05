import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'
import { extractTextFromFile, extractFirstImageFromDOCX } from '@/lib/utils/file-parser'
import { logError } from '@/lib/error-logger'
import type { BeautifyOutput } from '@/lib/types/domain'

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

    const rawText = await extractTextFromFile(new Blob([fileBuffer]), file_path)
    console.log('[parse] text extracted, length:', rawText.length)

    // Extract photo from DOCX (best-effort)
    let photoExtractedPath: string | null = null
    const fileExt = file_path.split('.').pop()?.toLowerCase()
    if (fileExt === 'docx' || fileExt === 'doc') {
      const photo = await extractFirstImageFromDOCX(fileBuffer)
      if (photo) {
        console.log('[parse] found embedded photo, contentType:', photo.contentType)
        const ext = photo.contentType.includes('png') ? 'png' : 'jpg'
        const photoPath = `extracted/${anonymous_id ?? upload_id}/profile.${ext}`
        const { error: photoUploadError } = await supabase.storage
          .from('photos')
          .upload(photoPath, photo.data, { contentType: photo.contentType, upsert: true })
        if (!photoUploadError) {
          // Generate a long-lived signed URL (24h) for the session
          const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(photoPath, 86400)
          photoExtractedPath = signedData?.signedUrl ?? null
          console.log('[parse] photo uploaded, signed URL generated')
        } else {
          console.error('[parse] photo upload failed:', photoUploadError.message)
        }
      }
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

    const prompt = await getPrompt('resume_beautify', market)
    console.log('[parse] calling AI, market:', market, 'prompt length:', prompt.length)

    const aiResponse = await callAI(
      'resume_beautify',
      [
        { role: 'system', content: prompt },
        { role: 'user', content: rawText }
      ],
      market
    )
    console.log('[parse] AI responded, length:', aiResponse.length, 'preview:', aiResponse.slice(0, 200))

    // Strip potential markdown code fences from AI response
    const cleaned = aiResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const output: BeautifyOutput = JSON.parse(cleaned)
    console.log('[parse] JSON parsed, experiences:', output?.experiences?.length, 'education:', output?.education?.length, 'skills:', output?.skills?.length)

    // Clear stale experiences for this anonymous session before inserting fresh parse results.
    // For user accounts we don't delete — they may have experiences from multiple sessions.
    if (!user_id && anonymous_id) {
      await supabase.from('work_experiences').delete().eq('anonymous_id', anonymous_id)
    }

    let tier1 = 0, tier2 = 0, tier3 = 0

    for (const exp of output.experiences ?? []) {
      // Post-process: if AI returned end_year but forgot to set is_current=false, fix it
      const hasEndYear = exp.end_year != null
      const isCurrentFinal = hasEndYear ? false : (exp.is_current ?? false)
      const endYearFinal = isCurrentFinal ? null : (exp.end_year ?? null)

      const { data: expRecord, error: expError } = await supabase
        .from('work_experiences')
        .insert({
          user_id: user_id ?? null,
          anonymous_id,
          company: exp.company ?? '',
          job_title: exp.job_title ?? '',
          start_year: exp.start_year ?? null,
          end_year: endYearFinal,
          is_current: isCurrentFinal
        })
        .select('id')
        .single()

      if (expError || !expRecord) {
        console.error('[parse] work_experience insert failed:', expError?.message, expError?.code)
        continue
      }

      const achievementsToInsert = exp.achievements.map((a) => ({
        experience_id: expRecord.id,
        text: a.text,
        status: 'confirmed',
        tier: a.tier,
        has_placeholders: a.has_placeholders,
        source: 'upload' as const
      }))

      const { error: achError } = await supabase.from('achievements').insert(achievementsToInsert)
      if (achError) console.error('[parse] achievements insert failed:', achError.message, achError.code)

      exp.achievements.forEach((a) => {
        if (a.tier === 1) tier1++
        else if (a.tier === 2) tier2++
        else tier3++
      })
    }

    // Save everything to resume_uploads
    await supabase
      .from('resume_uploads')
      .update({
        raw_text: rawText,
        parse_status: 'completed',
        photo_extracted_path: photoExtractedPath,
        parsed_data: {
          personal_info: output.personal_info ?? null,
          education: output.education ?? [],
          skills: output.skills ?? []
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
