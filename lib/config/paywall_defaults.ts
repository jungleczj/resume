/**
 * Static fallback paywall configuration.
 *
 * These values are used when:
 *   1. Redis cache misses AND DB is unreachable
 *   2. A new market/plan combination has no row in paywall_settings yet
 *
 * To change live pricing without a deploy:
 *   PUT /api/admin/paywall-config  (updates DB → Redis invalidated → 60s global refresh)
 *
 * NEVER use these values for payment decisions — always call getPaywallConfig().
 */

export interface MarketDefaults {
  enabled: boolean
  one_time?: number
  monthly?: number
  yearly?: number
}

export const PAYWALL_DEFAULTS: Record<'cn_free' | 'en_paid', MarketDefaults> = {
  cn_free: {
    enabled: false,           // Phase 1: CN market is completely free
  },
  en_paid: {
    enabled: true,
    one_time: 4.99,           // Single export
    monthly:  9.90,           // Monthly subscription
    yearly:   79.00,          // Annual subscription (~$6.6/mo)
  },
}

/** Convenience: EN-market prices (used by most callers) */
export const EN_PRICE_DEFAULTS = {
  one_time: PAYWALL_DEFAULTS.en_paid.one_time!,
  monthly:  PAYWALL_DEFAULTS.en_paid.monthly!,
  yearly:   PAYWALL_DEFAULTS.en_paid.yearly!,
}

export const REDIS_PAYWALL_KEY = 'paywall:config'
export const REDIS_TTL_SECONDS = 60
