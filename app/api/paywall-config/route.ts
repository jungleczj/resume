import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface PaywallConfig {
  one_time: number
  monthly: number
  yearly: number
}

const DEFAULTS: PaywallConfig = {
  one_time: 4.99,
  monthly: 9.9,
  yearly: 79
}

/**
 * GET /api/paywall-config
 * Returns current pricing for EN market plans.
 * Prices are public — no auth required.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('paywall_settings')
      .select('plan_type, price_usd')
      .eq('market', 'en_paid')
      .eq('is_active', true)

    if (error || !data?.length) {
      return NextResponse.json(DEFAULTS)
    }

    const config: PaywallConfig = { ...DEFAULTS }
    for (const row of data) {
      if (row.plan_type === 'per_export' || row.plan_type === 'one_time') {
        config.one_time = row.price_usd
      } else if (row.plan_type === 'monthly') {
        config.monthly = row.price_usd
      } else if (row.plan_type === 'yearly') {
        config.yearly = row.price_usd
      }
    }

    return NextResponse.json(config, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
    })
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}
