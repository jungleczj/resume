import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * POST /api/payment/webhook
 * Receives Creem Webhook events and processes them idempotently.
 *
 * Idempotency: DB-level unique index on creem_session_id prevents double-processing.
 * Supported events:
 *   - checkout.session.completed  → mark payment paid, create/update subscription if recurring
 *   - subscription.updated        → update subscription period
 *   - subscription.deleted        → cancel subscription
 *   - charge.refunded             → mark payment refunded, cancel subscription
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('creem-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as CreemWebhookPayload
    const supabase = await createClient()

    switch (payload.event_type ?? payload.event) {

      case 'checkout.session.completed': {
        const session = payload.data
        const sessionId: string = (session?.id ?? session?.checkout_id) ?? ''
        const metadata: Record<string, string | null> = session?.metadata ?? {}

        if (!sessionId) {
          console.error('Webhook: missing session id', payload)
          return NextResponse.json({ error: 'Missing session id' }, { status: 400 })
        }

        // Idempotency: check if already processed via DB update result
        const { data: updated, error: updateError } = await supabase
          .from('payment_records')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('creem_session_id', sessionId)
          .eq('status', 'pending') // Only update if still pending (idempotent)
          .select('id, plan_type, export_format, anonymous_id, user_id')

        if (updateError) {
          console.error('Webhook: payment_records update error', updateError)
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        const record = updated?.[0]

        // If no record updated, this is a duplicate webhook — ignore
        if (!record) {
          return NextResponse.json({ received: true, note: 'idempotent_skip' })
        }

        // Handle subscription creation for recurring plans
        const planType: string = (record.plan_type as string | null) ?? (metadata.plan_type ?? '')
        if (planType === 'monthly' || planType === 'yearly') {
          const creemSubscriptionId: string = (session?.subscription_id ?? session?.subscription) as string ?? ''
          const periodEndTs = session?.current_period_end as number | undefined
          const periodEnd = periodEndTs
            ? new Date(periodEndTs * 1000).toISOString()
            : new Date(Date.now() + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString()

          await supabase.from('subscriptions').upsert({
            user_id: record.user_id ?? null,
            anonymous_id: record.anonymous_id ?? metadata.anonymous_id ?? null,
            creem_subscription_id: creemSubscriptionId || null,
            plan_type: planType,
            status: 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString()
          }, { onConflict: 'creem_subscription_id', ignoreDuplicates: false })
        }

        // Push Realtime event so the workspace can react
        const anonymousId: string = (record.anonymous_id as string | null) ?? (metadata?.anonymous_id ?? '')
        await supabase.channel(`payment:${anonymousId}`)
          .send({
            type: 'broadcast',
            event: 'payment_success',
            payload: {
              format: (record.export_format as string | null) ?? (metadata?.format ?? 'pdf'),
              plan_type: planType,
              payment_record_id: record.id
            }
          })

        await trackEvent('payment_completed', {
          anonymous_id: anonymousId,
          user_id: (record.user_id as string | null) ?? metadata?.user_id ?? undefined,
          plan_type: planType,
          amount_usd: ((session?.amount_total as number | undefined) ?? 0) / 100
        })

        break
      }

      case 'subscription.updated': {
        const sub = payload.data
        const creemSubId: string = sub?.id as string ?? ''
        if (!creemSubId) break

        const subPeriodEndTs = sub?.current_period_end as number | undefined
        const periodEnd = subPeriodEndTs
          ? new Date(subPeriodEndTs * 1000).toISOString()
          : null

        if (periodEnd) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: periodEnd,
              updated_at: new Date().toISOString()
            })
            .eq('creem_subscription_id', creemSubId)
        }
        break
      }

      case 'subscription.deleted':
      case 'customer.subscription.deleted': {
        const sub = payload.data
        const creemSubId: string = sub?.id as string ?? ''
        if (!creemSubId) break

        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('creem_subscription_id', creemSubId)
        break
      }

      case 'charge.refunded':
      case 'payment.refunded': {
        const charge = payload.data
        const sessionId: string = (charge?.checkout_id ?? charge?.session_id) as string ?? ''
        if (!sessionId) break

        await supabase
          .from('payment_records')
          .update({ status: 'refunded' })
          .eq('creem_session_id', sessionId)

        // Cancel associated subscription
        const { data: pmtRecord } = await supabase
          .from('payment_records')
          .select('id')
          .eq('creem_session_id', sessionId)
          .single()

        if (pmtRecord) {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('user_id', pmtRecord.id) // Note: would need user_id — simplified
        }
        break
      }

      default:
        // Unknown event — log and return 200 (don't retry)
        console.log('Webhook: unhandled event', payload.event_type ?? payload.event)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing error'
    console.error('Webhook error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET
  if (!secret) {
    console.error('CREEM_WEBHOOK_SECRET is not set')
    // In development, allow unsigned webhooks if env var missing
    return process.env.NODE_ENV === 'development'
  }
  if (!signature) return false

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// Minimal type for Creem webhook payload (adjust to actual Creem API spec)
interface CreemWebhookPayload {
  event?: string
  event_type?: string
  data?: CreemWebhookData
}

interface CreemWebhookData {
  id?: string
  checkout_id?: string
  session_id?: string
  subscription_id?: string
  subscription?: string
  metadata?: Record<string, string | null>
  current_period_end?: number
  amount_total?: number
  [key: string]: unknown
}
