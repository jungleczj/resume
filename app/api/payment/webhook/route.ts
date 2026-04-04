import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'
import { createHmac, timingSafeEqual } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('creem-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

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

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET
  if (!secret) {
    console.error('CREEM_WEBHOOK_SECRET is not set')
    return false
  }
  if (!signature) return false

  // Creem sends HMAC-SHA256 hex digest in the creem-signature header
  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
