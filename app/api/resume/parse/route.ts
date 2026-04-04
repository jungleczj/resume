import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'
import { extractTextFromFile } from '@/lib/utils/file-parser'
import type { BeautifyOutput } from '@/lib/types/domain'

export async function POST(req: NextRequest) {
  // Internal-only endpoint: must be called with the shared secret
  const internalSecret = req.headers.get('x-internal-secret')
  if (!internalSecret || internalSecret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    const supabase = await createClient()

    // Mark as processing
    await supabase
      .from('resume_uploads')
      .update({ parse_status: 'processing' })
      .eq('id', upload_id)

    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(file_path)

    if (downloadError || !fileData) {
      throw new Error(`Cannot download file: ${downloadError?.message}`)
    }

    // Extract text (using Python runtime for PDF/DOCX — simplified here)
    const rawText = await extractTextFromFile(fileData, file_path)

    // Determine market from profile or default to cn
    let market: 'cn' | 'en' = 'cn'
    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user_id)
        .single()

      if (profile?.payment_market === 'en_paid') {
        market = 'en'
      }
    }

    // Get prompt from Supabase (hot-reloadable) with local fallback
    const prompt = await getPrompt('resume_beautify', market)

    // AI beautify via unified router (with fallback + p-queue)
    const aiResponse = await callAI(
      'resume_beautify',
      [
        { role: 'system', content: prompt },
        { role: 'user', content: rawText }
      ],
      market
    )

    const output: BeautifyOutput = JSON.parse(aiResponse)

    // Save work experiences + achievements
    let tier1 = 0, tier2 = 0, tier3 = 0

    for (const exp of output.experiences) {
      const { data: expRecord, error: expError } = await supabase
        .from('work_experiences')
        .insert({
          user_id: user_id ?? null,
          anonymous_id,
          company: exp.company,
          job_title: exp.job_title
        })
        .select('id')
        .single()

      if (expError || !expRecord) continue

      const achievementsToInsert = exp.achievements.map((a) => ({
        experience_id: expRecord.id,
        text: a.text,
        status: 'confirmed', // F1 path: skip confirmation page
        tier: a.tier,
        has_placeholders: a.has_placeholders,
        source: 'upload' as const
      }))

      await supabase.from('achievements').insert(achievementsToInsert)

      exp.achievements.forEach((a) => {
        if (a.tier === 1) tier1++
        else if (a.tier === 2) tier2++
        else tier3++
      })
    }

    // Save raw text + mark complete
    await supabase
      .from('resume_uploads')
      .update({
        raw_text: rawText,
        parse_status: 'completed'
      })
      .eq('id', upload_id)

    await trackEvent('f1_parse_completed', {
      anonymous_id,
      tier1_count: tier1,
      tier2_count: tier2,
      tier3_count: tier3,
      market
    })

    return NextResponse.json({ success: true, data: { tier1, tier2, tier3 } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed'

    // Mark as failed — upload_id is in scope from outer try block
    try {
      const supabase = await createClient()
      if (upload_id) {
        await supabase
          .from('resume_uploads')
          .update({ parse_status: 'failed', parse_error: message })
          .eq('id', upload_id)
      }
    } catch { /* ignore */ }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

