'use client'

/**
 * usePaywall()
 *
 * T-S02-3: CN market free logic gate.
 *
 * Returns:
 *   - isFree: true for cn_free users (no paywall ever shown)
 *   - hasAccess: true if user can export without paying (cn_free OR active subscription)
 *   - prices: current EN-market prices from /api/paywall-config
 *   - loading: true while async checks are in flight
 *
 * CRITICAL: payment decision uses ONLY payment_market, never geo.
 */

import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { EN_PRICE_DEFAULTS } from '@/lib/config/paywall_defaults'

export interface PaywallState {
  isFree: boolean
  hasAccess: boolean | null   // null while loading
  prices: typeof EN_PRICE_DEFAULTS
  loading: boolean
}

export function usePaywall(): PaywallState {
  const profile = useWorkspaceStore(s => s.profile)

  // CRITICAL: only payment_market determines free/paid — never geo
  const isFree = !profile || profile.payment_market === 'cn_free'

  const [prices, setPrices] = useState(EN_PRICE_DEFAULTS)
  const [hasAccess, setHasAccess] = useState<boolean | null>(isFree ? true : null)
  const [loading, setLoading] = useState(!isFree)

  useEffect(() => {
    if (isFree) {
      setHasAccess(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        const [priceRes, accessRes] = await Promise.all([
          fetch('/api/paywall-config'),
          fetch('/api/payment/check-access'),
        ])
        if (cancelled) return
        if (priceRes.ok) {
          const data = await priceRes.json() as typeof EN_PRICE_DEFAULTS
          setPrices(data)
        }
        if (accessRes.ok) {
          const data = await accessRes.json() as { has_access: boolean }
          setHasAccess(data.has_access)
        }
      } catch {
        // Network error — default to gated
        if (!cancelled) setHasAccess(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isFree])

  return { isFree, hasAccess, prices, loading }
}
