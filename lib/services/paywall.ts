import { createClient } from '@/lib/supabase/server'
import type { PaymentMarket } from '@/lib/types/domain'

/**
 * Returns current pricing from paywall_settings table.
 * Falls back to hardcoded defaults if DB is unavailable.
 * CRITICAL: These prices are for EN market only — CN is always free.
 */
export async function getPaywallPrices(): Promise<{
  one_time: number
  monthly: number
  yearly: number
}> {
  const defaults = { one_time: 4.99, monthly: 9.9, yearly: 79 }

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('paywall_settings')
      .select('plan_type, price_usd')
      .eq('market', 'en_paid')
      .eq('is_active', true)

    if (!data?.length) return defaults

    const result = { ...defaults }
    for (const row of data) {
      if (row.plan_type === 'per_export' || row.plan_type === 'one_time') {
        result.one_time = row.price_usd
      } else if (row.plan_type === 'monthly') {
        result.monthly = row.price_usd
      } else if (row.plan_type === 'yearly') {
        result.yearly = row.price_usd
      }
    }
    return result
  } catch {
    return defaults
  }
}

/**
 * Determines if paywall should trigger for a user.
 * ONLY reads payment_market and subscriptions — never geo data.
 *
 * Rules:
 * - cn_free → no paywall
 * - en_paid + active subscription → no paywall
 * - en_paid, no subscription → show paywall
 * - anonymous (no profile) → no paywall (pay per-export handled separately)
 */
export async function shouldShowPaywall(
  userId: string | null,
  _triggerEvent: string
): Promise<{ show: boolean; market: PaymentMarket }> {
  if (!userId) {
    return { show: false, market: 'cn_free' }
  }

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_market')
    .eq('id', userId)
    .single()

  const market = (profile?.payment_market ?? 'cn_free') as PaymentMarket

  // CN free — always allow
  if (market === 'cn_free') {
    return { show: false, market }
  }

  // EN paid: check active subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_end, grace_until')
    .eq('user_id', userId)
    .in('status', ['active', 'grace'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub) {
    const now = new Date()
    const periodEnd = new Date(sub.current_period_end as string)
    const graceEnd = sub.grace_until ? new Date(sub.grace_until as string) : null
    const isValid = periodEnd > now || (graceEnd !== null && graceEnd > now)
    if (isValid) return { show: false, market }
  }

  return { show: true, market }
}
