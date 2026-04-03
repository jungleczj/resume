import { createClient } from '@/lib/supabase/server'
import type { PaymentMarket, PaywallSettings } from '@/lib/types/domain'

/**
 * Paywall settings are hot-reloaded from Supabase.
 * CRITICAL: Payment decisions must ONLY use payment_market, never geo.country
 */
export async function getPaywallSettings(
  market: PaymentMarket,
  triggerEvent: string
): Promise<PaywallSettings | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('paywall_settings')
    .select('*')
    .eq('market', market)
    .eq('trigger_event', triggerEvent)
    .eq('is_enabled', true)
    .single()

  return data ?? null
}

/**
 * Determines if paywall should trigger for a user.
 * ONLY reads payment_market — never geo data.
 */
export async function shouldShowPaywall(
  userId: string | null,
  triggerEvent: string
): Promise<{ show: boolean; settings: PaywallSettings | null }> {
  if (!userId) {
    // Anonymous users: cn_free by default
    return { show: false, settings: null }
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_market')
    .eq('id', userId)
    .single()

  // ONLY payment_market drives paywall decision
  const market = profile?.payment_market ?? 'cn_free'

  if (market === 'cn_free') {
    return { show: false, settings: null }
  }

  const settings = await getPaywallSettings('en_paid', triggerEvent)
  return { show: settings?.is_enabled ?? false, settings }
}
