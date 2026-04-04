'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { X, FileText, Download, Loader2, Check, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/domain'

interface ExportModalProps {
  format: 'pdf' | 'docx'
  anonymousId: string
  userId: string | null
  profile: Profile | null
  onClose: () => void
}

export function ExportModal({
  format: _initialFormat,
  anonymousId,
  userId,
  profile,
  onClose
}: ExportModalProps) {
  const t = useTranslations()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CRITICAL: payment decision uses ONLY payment_market, never geo
  const isCNFree = !profile || profile.payment_market === 'cn_free'

  const handleDownload = async () => {
    setExporting(true)
    setError(null)

    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format: 'pdf',
      market: isCNFree ? 'cn_free' : 'en_paid'
    })

    try {
      const res = await fetch('/api/resume/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          anonymous_id: anonymousId,
          user_id: userId
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await trackEvent('export_completed', {
        anonymous_id: anonymousId,
        format: 'pdf',
        market: 'cn_free'
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleUpgrade = () => {
    trackEvent('paywall_upgrade_clicked', {
      anonymous_id: anonymousId,
      source: 'export_modal'
    })
    onClose()
    router.push('/pricing')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t('export.modal_title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isCNFree ? (
            /* CN Free: Direct download */
            <CNExportState
              exporting={exporting}
              error={error}
              onDownload={handleDownload}
              t={t}
            />
          ) : (
            /* EN Paid: Upgrade CTA */
            <ENPaywallState
              onUpgrade={handleUpgrade}
              onClose={onClose}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CNExportState({
  exporting,
  error,
  onDownload,
  t
}: {
  exporting: boolean
  error: string | null
  onDownload: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="text-center">
      {/* PDF icon with check */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-brand" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full mb-4">
        <Check className="w-3 h-3 text-green-600" />
        <span className="text-xs font-medium text-green-700">{t('export.free_badge')}</span>
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}

      <button
        onClick={onDownload}
        disabled={exporting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {exporting ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{t('export.processing')}</>
        ) : (
          <><Download className="w-4 h-4" />{t('export.download_btn')}</>
        )}
      </button>
    </div>
  )
}

function ENPaywallState({
  onUpgrade,
  onClose,
  t
}: {
  onUpgrade: () => void
  onClose: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const features = t.raw('export.paywall.features') as string[]

  return (
    <div>
      {/* PDF icon */}
      <div className="flex items-center justify-center mb-4">
        <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
          <FileText className="w-7 h-7 text-brand" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
        {t('export.paywall.title')}
      </h3>
      <p className="text-sm text-gray-500 text-center mb-5">
        {t('export.paywall.subtitle')}
      </p>

      {/* Features */}
      <ul className="space-y-2.5 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
            <div className="w-5 h-5 bg-brand-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-brand" />
            </div>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={onUpgrade}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors mb-2',
          'bg-brand text-white hover:bg-brand-700'
        )}
      >
        <Sparkles className="w-4 h-4" />
        {t('export.paywall.upgrade_btn')}
      </button>

      <button
        onClick={onClose}
        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        {t('export.paywall.later')}
      </button>
    </div>
  )
}
