import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai-router'
import { getPrompt } from '@/lib/prompts'
import { trackEvent } from '@/lib/analytics'
import { extractTextFromFile, extractPhotoFromPDF } from '@/lib/utils/file-parser'
import type { BeautifyOutput } from '@/lib/types/domain'

interface ParsedInfo {
  name: string | null
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
  website: string | null
}

function extractPersonalInfo(text: string): ParsedInfo {
  const info: ParsedInfo = {
    name: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    website: null
  }

  const lines = text.split('\n').slice(0, 30)
  const combinedText = lines.join('\n')

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = combinedText.match(emailRegex)
  if (emails && emails.length > 0) {
    info.email = emails[0].toLowerCase()
  }

  const phonePatterns = [
    /(?:\+?86[-.\s]?)?1[3-9]\d[-.\s]?\d{4}[-.\s]?\d{4}/g,
    /\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\+?[\d\s\-()]{10,20}/g
  ]
  for (const pattern of phonePatterns) {
    const phones = combinedText.match(pattern)
    if (phones && phones.length > 0) {
      const phone = phones[0].replace(/\s+/g, ' ').trim()
      if (phone.length >= 10) {
        info.phone = phone
        break
      }
    }
  }

  const linkedinRegex = /(?:linkedin\.com\/in\/|linkedin\.com\/profile\.php\?member_id=)([a-zA-Z0-9-]+)/i
  const linkedinMatch = combinedText.match(linkedinRegex)
  if (linkedinMatch) {
    info.linkedin = `linkedin.com/in/${linkedinMatch[1]}`
  } else {
    const linkedinUrlRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/gi
    const linkedinUrls = combinedText.match(linkedinUrlRegex)
    if (linkedinUrls && linkedinUrls.length > 0) {
      info.linkedin = linkedinUrls[0].replace(/^https?:\/\/(?:www\.)?/, '')
    }
  }

  const nameRegex = /^([A-Z][a-zA-Z]{1,20}\s+[A-Z][a-zA-Z]{1,20})/
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim()
    if (trimmed.length > 0 && trimmed.length < 50) {
      const nameMatch = trimmed.match(nameRegex)
      if (nameMatch) {
        info.name = nameMatch[1]
        break
      }
    }
  }

  const locationPatterns = [
    /(?:location|地址|所在地)[:\s]*([^\n,]{2,30})/i,
    /([A-Z][a-z]+,\s*[A-Z]{2})\s*\n/,
    /(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|苏州|天津|重庆)/g
  ]
  for (const pattern of locationPatterns) {
    const match = combinedText.match(pattern)
    if (match) {
      info.location = typeof match[1] === 'string' ? match[1] : match[0]
      break
    }
  }

  const websiteRegex = /(?:个人网站|portfolio|website)[:\s]*(https?:\/\/[^\s]+)/i
  const websiteMatch = combinedText.match(websiteRegex)
  if (websiteMatch) {
    info.website = websiteMatch[1]
  }

  return info
}

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

    for (let index = 0; index < output.experiences.length; index++) {
      const exp = output.experiences[index]
      const { data: expRecord, error: expError } = await supabase
        .from('work_experiences')
        .insert({
          user_id: user_id ?? null,
          anonymous_id,
          company: exp.company,
          job_title: exp.job_title,
          start_year: exp.start_year,
          start_month: exp.start_month,
          end_year: exp.end_year,
          end_month: exp.end_month,
          original_date_text: exp.original_date_text,
          is_current: exp.end_year === null || exp.end_year === undefined,
          sort_order: index
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

    // Extract personal info from raw text
    const parsedInfo = extractPersonalInfo(rawText)

    // Save raw text, parsed info + mark complete
    await supabase
      .from('resume_uploads')
      .update({
        raw_text: rawText,
        parse_status: 'completed',
        parsed_info: parsedInfo
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

