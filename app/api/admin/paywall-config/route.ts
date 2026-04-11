/**
 * PUT /api/admin/paywall-config
 *
 * Hot-reload paywall settings without a deploy.
 * Updates paywall_settings DB rows → invalidates Redis → 60s global refresh.
 *
 * Security: dual-layer auth
 *   1. x-admin-token header must match ADMIN_API_TOKEN env var
 *   2. IP must be in ADMIN_IP_WHITELIST env var (comma-separated CIDRs or IPs)
 *      If ADMIN_IP_WHITELIST is empty/unset, IP check is skipped (dev mode).
 *
 * Request body:
 *   {
 *     "one_time": 4.99,      // optional — null skips this plan
 *     "monthly": 9.9,
 *     "yearly": 79
 *   }
 *
 * Response:
 *   { success: true, prices: { one_time, monthly, yearly }, cached_invalidated: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { invalidatePaywallCache } from '@/lib/services/paywall'

export const dynamic = 'force-dynamic'

// ── Auth helpers ──────────────────────────────────────────────────────────────

function checkAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const expected = process.env.ADMIN_API_TOKEN
  if (!expected) {
    // No token configured → only allow in development
    return process.env.NODE_ENV === 'development'
  }
  return token === expected
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function checkIpWhitelist(ip: string): boolean {
  const whitelist = process.env.ADMIN_IP_WHITELIST
  if (!whitelist) return true // no whitelist configured — allow all
  const allowed = whitelist.split(',').map(s => s.trim())
  return allowed.includes(ip) || allowed.includes('*')
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  // 1. Token check
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. IP whitelist check
  const clientIp = getClientIp(req)
  if (!checkIpWhitelist(clientIp)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse body
  let body: { one_time?: number; monthly?: number; yearly?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 4. Fetch current values for audit log
  const { data: currentRows } = await supabase
    .from('paywall_settings')
    .select('plan_type, price_usd')
    .eq('market', 'en_paid')

  const beforeValue = currentRows ?? []

  // 5. Update each plan type provided
  const updates: Array<{ plan_type: string; price: number }> = []
  if (typeof body.one_time === 'number') updates.push({ plan_type: 'one_time', price: body.one_time })
  if (typeof body.monthly === 'number') updates.push({ plan_type: 'monthly', price: body.monthly })
  if (typeof body.yearly === 'number') updates.push({ plan_type: 'yearly', price: body.yearly })

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No price fields provided' }, { status: 400 })
  }

  for (const { plan_type, price } of updates) {
    const { error } = await supabase
      .from('paywall_settings')
      .update({ price_usd: price, updated_at: new Date().toISOString() })
      .eq('market', 'en_paid')
      .eq('plan_type', plan_type)

    if (error) {
      console.error(`[admin/paywall-config] update ${plan_type} failed:`, error.message)
      return NextResponse.json({ error: `Failed to update ${plan_type}: ${error.message}` }, { status: 500 })
    }
  }

  // 6. Invalidate Redis cache so new prices propagate within 60s
  let cacheInvalidated = false
  try {
    await invalidatePaywallCache()
    cacheInvalidated = true
  } catch { /* Redis not configured — OK */ }

  // 7. Write admin audit log
  const afterValue = updates.map(u => ({ plan_type: u.plan_type, price_usd: u.price }))
  await supabase.from('admin_audit_log').insert({
    action: 'update_paywall_config',
    changed_by: req.headers.get('x-admin-user') ?? 'admin',
    ip_address: clientIp,
    resource: 'paywall_settings',
    before_value: beforeValue as unknown as Record<string, unknown>[],
    after_value: afterValue,
  }).then(({ error }) => {
    if (error) console.warn('[admin/paywall-config] audit log write failed:', error.message)
  })

  // 8. Return updated prices
  const newPrices = Object.fromEntries(updates.map(u => [u.plan_type, u.price]))

  return NextResponse.json({
    success: true,
    prices: newPrices,
    cache_invalidated: cacheInvalidated,
  })
}

/** GET — returns current paywall config (for admin UI) */
export async function GET(req: NextRequest) {
  if (!checkAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const clientIp = getClientIp(req)
  if (!checkIpWhitelist(clientIp)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('paywall_settings')
    .select('plan_type, price_usd, is_active, updated_at')
    .eq('market', 'en_paid')
    .order('plan_type')

  return NextResponse.json({ settings: data ?? [] })
}
