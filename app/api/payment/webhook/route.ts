import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const signature = req.headers.get('creem-signature')

    // Verify webhook signature
    if (!verifySignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const supabase = await createClient()

    if (payload.event === 'checkout.session.completed') {
      const sessionId = payload.data.id
      const metadata = payload.data.metadata

      // Update payment record
      await supabase
        .from('payment_records')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('creem_session_id', sessionId)

      await trackEvent('payment_completed', {
        anonymous_id: metadata.anonymous_id,
        plan_type: metadata.plan_type,
        amount_usd: payload.data.amount_total / 100
      })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function verifySignature(payload: any, signature: string | null): boolean {
  // TODO: Implement Creem signature verification
  return true
}
