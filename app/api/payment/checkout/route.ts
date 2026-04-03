import { NextRequest, NextResponse } from 'next/server'
import { createCreemCheckout } from '@/lib/services/creem'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'

export async function POST(req: NextRequest) {
  try {
    const { plan_type, format } = await req.json()
    const anonymousId = req.cookies.get('anonymous_id')?.value || crypto.randomUUID()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Get pricing from paywall_settings
    const { data: settings } = await supabase
      .from('paywall_settings')
      .select('*')
      .eq('market', 'en_paid')
      .eq('trigger_event', 'export')
      .single()

    const amount = settings?.price_usd || 9.99

    const { checkout_url, session_id } = await createCreemCheckout({
      userId: user?.id,
      anonymousId,
      planType: plan_type,
      format,
      amount,
      currency: 'USD'
    })

    // Save payment record
    await supabase.from('payment_records').insert({
      user_id: user?.id,
      anonymous_id: anonymousId,
      market: 'en_paid',
      provider: 'creem',
      currency: 'USD',
      amount,
      plan_type,
      status: 'pending',
      creem_session_id: session_id
    })

    await trackEvent('payment_initiated', {
      anonymous_id: anonymousId,
      plan_type,
      format,
      amount_usd: amount
    })

    return NextResponse.json({ checkout_url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
