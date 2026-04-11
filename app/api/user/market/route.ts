/**
 * PATCH /api/user/market
 *
 * T-S02-1: Write user's confirmed payment_market.
 * Called once when the user selects "中国大陆" or "其他地区" in the MarketConfirmModal.
 *
 * After this call:
 *   - profiles.payment_market = 'cn_free' | 'en_paid'
 *   - profiles.payment_market_confirmed = true
 *   - The cf_market cookie is refreshed so middleware reads the updated value without DB
 *
 * Security:
 *   - Only authenticated users can update their own profile.
 *   - payment_market cannot be changed once confirmed (write-once enforcement).
 *     If you need to override, do it directly in Supabase Studio.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { trackEvent } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let market: string
  try {
    const body = await req.json() as { market: string }
    market = body.market
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (market !== 'cn_free' && market !== 'en_paid') {
    return NextResponse.json({ error: 'Invalid market value' }, { status: 400 })
  }

  // Check if already confirmed — write-once enforcement
  const serviceClient = createServiceClient()
  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('payment_market_confirmed, payment_market')
    .eq('id', user.id)
    .single()

  if (existingProfile?.payment_market_confirmed) {
    // Already confirmed — return current value without error (idempotent)
    return NextResponse.json({
      payment_market: existingProfile.payment_market,
      already_confirmed: true,
    })
  }

  // Write market + confirmation flag
  const { error } = await serviceClient
    .from('profiles')
    .update({
      payment_market: market,
      payment_market_confirmed: true,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[user/market] update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void trackEvent('market_confirmed', {
    user_id: user.id,
    market,
  })

  // Refresh cf_market cookie so middleware reads new value immediately
  const response = NextResponse.json({ payment_market: market, confirmed: true })
  response.cookies.set('cf_market', market, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
