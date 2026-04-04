import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { shouldShowPaywall } from '@/lib/services/paywall'
import { createCreemCheckout } from '@/lib/services/creem'
import { trackEvent } from '@/lib/analytics'
import { generatePDF } from '@/lib/utils/pdf-generator'
import { generateDOCX } from '@/lib/utils/docx-generator'

export async function POST(req: NextRequest) {
  try {
    const { format, anonymous_id, user_id, version_id } = await req.json()

    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    const supabase = await createClient()

    // Paywall check: only for authenticated EN users
    const { show: needsPayment } = await shouldShowPaywall(user_id ?? null, 'export')

    if (needsPayment) {
      const checkout = await createCreemCheckout({
        userId: user_id,
        anonymousId: anonymous_id,
        planType: 'per_export',
        format: format as 'pdf' | 'docx',
        amount: 4.99,
        currency: 'usd'
      })
      return NextResponse.json(
        { requires_payment: true, checkout_url: checkout.checkout_url },
        { status: 402 }
      )
    }

    // Load profile for name/contact info
    let name = ''
    let email = ''
    let phone = ''
    let lang: 'zh' | 'en' = 'zh'

    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user_id)
        .single()
      if (profile) {
        lang = profile.resume_lang_preference === 'en' ? 'en' : 'zh'
        phone = profile.phone ?? ''
      }

      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        email = authData.user.email ?? ''
        // full_name set during OAuth or sign-up
        name = (authData.user.user_metadata?.full_name as string | undefined)
          ?? (authData.user.user_metadata?.name as string | undefined)
          ?? ''
      }
    }

    // Load experiences + confirmed achievements
    const query = supabase
      .from('work_experiences')
      .select('*, achievements(*)')
      .order('sort_order', { ascending: true })

    const { data: experiences, error: expError } = user_id
      ? await query.eq('user_id', user_id)
      : await query.eq('anonymous_id', anonymous_id)

    if (expError) throw new Error(expError.message)

    // Filter to confirmed achievements only
    const expWithConfirmed = (experiences ?? []).map((exp) => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter(
        (a: Record<string, unknown>) => a.status === 'confirmed'
      )
    }))

    // Show photo setting: from version if provided, else default by lang
    let showPhoto = lang === 'zh'
    if (version_id) {
      const { data: ver } = await supabase
        .from('resume_versions')
        .select('show_photo, photo_path')
        .eq('id', version_id)
        .single()
      if (ver) showPhoto = ver.show_photo
    }

    const blob =
      format === 'pdf'
        ? await generatePDF({
            name,
            contact: { email, phone },
            experiences: expWithConfirmed,
            showPhoto,
            lang
          })
        : await generateDOCX({
            name,
            contact: { email, phone },
            experiences: expWithConfirmed,
            lang
          })

    await trackEvent('export_completed', {
      anonymous_id,
      format,
      lang,
      has_photo: showPhoto
    })

    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="resume.${format}"`
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
