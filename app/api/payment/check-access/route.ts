import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/payment/check-access
 * Returns whether the current user has paid export access.
 *
 * Rules (CRITICAL: payment_market only — never geo):
 * - cn_free → has_access: true (always free)
 * - en_paid + active subscription → has_access: true
 * - en_paid, no subscription → has_access: false
 * - anonymous (no profile) → has_access: false (must pay per-export)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const anonymousId = req.cookies.get('anonymous_id')?.value

    if (!user && !anonymousId) {
      return NextResponse.json({ has_access: false, reason: 'no_identity' })
    }

    // Check profile payment_market
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user.id)
        .single()

      // CN free market — always has access
      if (profile?.payment_market === 'cn_free') {
        return NextResponse.json({ has_access: true, reason: 'cn_free' })
      }

      // EN paid: check active subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, status, current_period_end, grace_until')
        .eq('user_id', user.id)
        .in('status', ['active', 'grace'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (sub) {
        const now = new Date()
        const periodEnd = new Date(sub.current_period_end)
        const graceEnd = sub.grace_until ? new Date(sub.grace_until) : null
        const isValid = periodEnd > now || (graceEnd && graceEnd > now)
        if (isValid) {
          return NextResponse.json({ has_access: true, reason: 'subscription' })
        }
      }

      return NextResponse.json({ has_access: false, reason: 'en_paid_no_sub' })
    }

    // Anonymous user — no profile, no subscription → must pay
    return NextResponse.json({ has_access: false, reason: 'anonymous' })
  } catch {
    return NextResponse.json({ has_access: false, reason: 'error' })
  }
}
