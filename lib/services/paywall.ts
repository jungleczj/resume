import { createClient } from '@/lib/supabase/server'
import { EN_PRICE_DEFAULTS, PAYWALL_DEFAULTS, REDIS_PAYWALL_KEY, REDIS_TTL_SECONDS } from '@/lib/config/paywall_defaults'
import type { PaymentMarket } from '@/lib/types/domain'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaywallPrices {
  one_time: number
  monthly: number
  yearly: number
}

// ── Redis helper (optional — same pattern as lib/rate-limit.ts) ───────────────

interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>
  del(key: string): Promise<unknown>
}

let _redis: RedisClient | null = null

async function getRedis(): Promise<RedisClient | null> {
  if (_redis) return _redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    // @ts-ignore — optional peer dependency
    const mod = require('@upstash/redis') as { Redis: { fromEnv(): RedisClient } }
    _redis = mod.Redis.fromEnv()
    return _redis
  } catch {
    return null
  }
}

// ── getPaywallConfig: Redis → DB → static fallback ────────────────────────────

/**
 * Returns current EN-market paywall prices.
 * Three-tier resolution: Redis (60s TTL) → Supabase DB → static defaults.
 * CN market is always free — callers should check payment_market first.
 */
export async function getPaywallConfig(): Promise<PaywallPrices> {
  // Tier 1: Redis cache
  const redis = await getRedis()
  if (redis) {
    try {
      const cached = await redis.get(REDIS_PAYWALL_KEY)
      if (cached) {
        return JSON.parse(cached) as PaywallPrices
      }
    } catch {
      // Redis miss / error — fall through to DB
    }
  }

  // Tier 2: Supabase DB
  let prices: PaywallPrices | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('paywall_settings')
      .select('plan_type, price_usd')
      .eq('market', 'en_paid')
      .eq('is_active', true)

    if (data?.length) {
      prices = { ...EN_PRICE_DEFAULTS }
      for (const row of data) {
        if (row.plan_type === 'per_export' || row.plan_type === 'one_time') {
          prices.one_time = row.price_usd
        } else if (row.plan_type === 'monthly') {
          prices.monthly = row.price_usd
        } else if (row.plan_type === 'yearly') {
          prices.yearly = row.price_usd
        }
      }
    }
  } catch {
    // DB unavailable — fall through to static
  }

  const result = prices ?? EN_PRICE_DEFAULTS

  // Backfill Redis cache
  if (redis && prices) {
    try {
      await redis.set(REDIS_PAYWALL_KEY, JSON.stringify(result), { ex: REDIS_TTL_SECONDS })
    } catch { /* ignore */ }
  }

  return result
}

/** @deprecated Use getPaywallConfig() — this alias exists for backwards compatibility */
export const getPaywallPrices = getPaywallConfig

// ── shouldShowPaywall ─────────────────────────────────────────────────────────

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

  const market = (profile?.payment_market ?? PAYWALL_DEFAULTS.cn_free) as PaymentMarket

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

// ── invalidatePaywallCache ────────────────────────────────────────────────────

/** Called by the Admin API after updating paywall_settings to force immediate propagation */
export async function invalidatePaywallCache(): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    try {
      await redis.del(REDIS_PAYWALL_KEY)
    } catch { /* ignore */ }
  }
}
