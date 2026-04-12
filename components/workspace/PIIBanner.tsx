'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface PIIBannerProps { uploadId?: string; anonymousId: string; userId: string | null }

export function PIIBanner({ uploadId, anonymousId, userId }: PIIBannerProps) {
  const t = useTranslations('workspace')
  const [show, setShow] = useState(false)
  const storageKey = `pii_banner_closed_${uploadId ?? anonymousId}`

  useEffect(() => {
    if (!uploadId) return
    if (localStorage.getItem(storageKey)) return
    // Check pii_detected from parse-status
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)
    fetch(`/api/resume/parse-status?${params}`)
      .then(r => r.json())
      .then((d: { pii_detected?: boolean }) => { if (d.pii_detected) setShow(true) })
      .catch(() => {})
  }, [uploadId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3 text-xs text-amber-800">
      <span className="material-symbols-outlined text-amber-500 text-sm flex-shrink-0">warning</span>
      <span className="flex-1">{t('pii_banner')}</span>
      <button
        onClick={() => { localStorage.setItem(storageKey, '1'); setShow(false) }}
        className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  )
}
