import { NextResponse } from 'next/server'
import { getPaywallConfig } from '@/lib/services/paywall'

/**
 * GET /api/paywall-config
 * Returns current pricing for EN market plans.
 * Prices are public — no auth required.
 * Uses the three-tier getPaywallConfig(): Redis → DB → static fallback.
 */
export async function GET() {
  const config = await getPaywallConfig()
  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
  })
}
