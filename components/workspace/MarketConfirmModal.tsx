'use client'

/**
 * MarketConfirmModal
 *
 * T-S02-1: payment_market write + confirmation modal.
 *
 * Shown once to newly registered users whose payment_market_confirmed = false.
 * User selects "中国大陆 (免费)" or "其他地区" and the choice is persisted to DB.
 * Once confirmed, the modal never shows again (write-once, checked via payment_market_confirmed).
 *
 * Geo is used ONLY to pre-select the default option — not to auto-submit.
 * The user must always explicitly click a button.
 */

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Globe, MapPin, Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace'

interface MarketConfirmModalProps {
  /** ISO country code hint from Vercel geo — used to pre-select default only */
  geoCountryHint?: string | null
  onConfirmed: (market: 'cn_free' | 'en_paid') => void
}

export function MarketConfirmModal({ geoCountryHint, onConfirmed }: MarketConfirmModalProps) {
  const router = useRouter()
  const t = useTranslations('market_confirm')
  const setProfile = useWorkspaceStore(s => s.setProfile)
  const profile = useWorkspaceStore(s => s.profile)

  // Pre-select based on geo hint but never auto-submit
  const isCNHint = geoCountryHint === 'CN'
  const [selected, setSelected] = useState<'cn_free' | 'en_paid' | null>(
    isCNHint ? 'cn_free' : 'en_paid'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/user/market', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: selected }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }

      // Update the Zustand store so the rest of the workspace reacts immediately
      if (profile) {
        setProfile({ ...profile, payment_market: selected, payment_market_confirmed: true })
      }

      onConfirmed(selected)

      // Reload page so server-side components pick up the new market
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <Globe className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">{t('title')}</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Options */}
        <div className="px-6 pb-4 space-y-3">
          <button
            onClick={() => setSelected('cn_free')}
            className={`w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
              selected === 'cn_free'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected === 'cn_free' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{t('cn_name')}</span>
                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{t('cn_badge')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t('cn_desc')}</p>
            </div>
          </button>

          <button
            onClick={() => setSelected('en_paid')}
            className={`w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
              selected === 'en_paid'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Globe className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected === 'en_paid' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-900">{t('intl_name')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('intl_desc')}</p>
            </div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="px-6 pb-2 text-xs text-red-500">{error}</p>
        )}

        {/* Confirm button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t('saving')}</>
            ) : (
              t('confirm')
            )}
          </button>
          <p className="text-center text-[11px] text-gray-400 mt-3">
            {t('footer')}
          </p>
        </div>
      </div>
    </div>
  )
}
