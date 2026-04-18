import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'
import { getPaywallConfig } from '@/lib/services/paywall'

/**
 * POST /api/payment/create-session
 * Creates a Creem Checkout Session for EN paid users.
 *
 * Body: { plan_type: 'one_time' | 'monthly' | 'yearly', format: 'pdf' | 'docx' }
 * Returns: { checkout_url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { plan_type, format } = await req.json() as {
      plan_type: 'one_time' | 'monthly' | 'yearly'
      format: 'pdf' | 'docx'
    }

    if (!['one_time', 'monthly', 'yearly'].includes(plan_type)) {
      return NextResponse.json({ error: 'Invalid plan_type' }, { status: 400 })
    }
    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const anonymousId = req.cookies.get('anonymous_id')?.value ?? crypto.randomUUID()

    // Get price via Redis → DB → static fallback (three-tier)
    const prices = await getPaywallConfig()
    const amount = prices[plan_type as keyof typeof prices] ?? prices.one_time
    const dbPlanType = plan_type === 'one_time' ? 'per_export' : plan_type

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const successUrl = `${appUrl}/payment/success?format=${format}&anon_id=${anonymousId}&plan=${plan_type}`
    const cancelUrl = `${appUrl}/workspace`

    // Call Creem API to create checkout session
    const creemRes = await fetch('https://api.creem.io/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CREEM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success_url: successUrl,
        cancel_url: cancelUrl,
        request_id: crypto.randomUUID(),
        metadata: {
          user_id: user?.id ?? null,
          anonymous_id: anonymousId,
          plan_type,
          format
        },
        ...(plan_type === 'one_time'
          ? {
              // One-time payment
              items: [{
                price: {
                  amount: Math.round(amount * 100),
                  currency: 'usd',
                  type: 'one_time',
                  product: {
                    name: 'Resume Export',
                    description: `Export your resume as ${format.toUpperCase()}`
                  }
                },
                quantity: 1
              }]
            }
          : {
              // Subscription
              items: [{
                price: {
                  amount: Math.round(amount * 100),
                  currency: 'usd',
                  type: 'recurring',
                  recurring: {
                    interval: plan_type === 'monthly' ? 'month' : 'year',
                    interval_count: 1
                  },
                  product: {
                    name: `CareerFlow ${plan_type === 'monthly' ? 'Monthly' : 'Yearly'} Plan`,
                    description: 'Unlimited resume exports + Notion sync + version history'
                  }
                },
                quantity: 1
              }]
            })
      })
    })

    if (!creemRes.ok) {
      const errBody = await creemRes.text()
      console.error('Creem checkout creation failed:', creemRes.status, errBody)
      return NextResponse.json({ error: 'Payment service unavailable' }, { status: 502 })
    }

    const creemData = await creemRes.json() as { checkout_url?: string; url?: string; id?: string }
    const checkoutUrl = creemData.checkout_url ?? creemData.url

    if (!checkoutUrl) {
      console.error('Creem response missing checkout_url:', creemData)
      return NextResponse.json({ error: 'Invalid payment service response' }, { status: 502 })
    }

    // Write pending payment record
    await supabase.from('payment_records').insert({
      user_id: user?.id ?? undefined,
      anonymous_id: anonymousId,
      market: 'en_paid',
      provider: 'creem',
      currency: 'USD',
      amount,
      plan_type: dbPlanType,
      export_format: format,
      status: 'pending',
      creem_session_id: creemData.id ?? undefined
    })

    await trackEvent('payment_initiated', {
      anonymous_id: anonymousId,
      user_id: user?.id ?? undefined,
      plan_type,
      format,
      amount_usd: amount
    })

    return NextResponse.json({ checkout_url: checkoutUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session creation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
