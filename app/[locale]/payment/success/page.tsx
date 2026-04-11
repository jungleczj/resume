'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { Check, Download, Loader2, AlertCircle } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

type State = 'verifying' | 'generating' | 'ready' | 'error'

export default function PaymentSuccessPage() {
  const t = useTranslations('payment_success')
  const params = useSearchParams()
  const format = (params.get('format') ?? 'pdf') as 'pdf' | 'docx'
  const anonymousId = params.get('anon_id') ?? ''

  const [state, setState] = useState<State>('verifying')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const triggered = useRef(false)

  useEffect(() => {
    if (triggered.current) return
    triggered.current = true
    triggerExport()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerExport = async () => {
    setState('verifying')

    // Poll payment_records until status = paid (max 15s, handles webhook race)
    let paid = false
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`/api/payment/verify?anon_id=${anonymousId}&format=${format}`)
      if (res.ok) {
        const data = await res.json() as { paid: boolean }
        if (data.paid) { paid = true; break }
      }
      await new Promise(r => setTimeout(r, 1000))
    }

    if (!paid) {
      setState('error')
      setError('Payment verification timed out. Please contact support.')
      return
    }

    setState('generating')

    // Trigger file generation
    const exportRes = await fetch('/api/resume/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, anonymous_id: anonymousId })
    })

    if (!exportRes.ok) {
      setState('error')
      const data = await exportRes.json() as { error?: string }
      setError(data.error ?? 'Export failed. Please try again from the workspace.')
      return
    }

    const blob = await exportRes.blob()
    const url = URL.createObjectURL(blob)
    setDownloadUrl(url)
    setState('ready')

    // Auto-trigger download
    const a = document.createElement('a')
    a.href = url
    a.download = `resume.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    await trackEvent('export_completed', {
      anonymous_id: anonymousId,
      format,
      source: 'payment_success'
    })
  }

  return (
    <main className="min-h-screen bg-[#fcf8ff] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full px-8 py-10 text-center">

        {state === 'verifying' && (
          <>
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('verifying_title')}</h1>
            <p className="text-sm text-gray-500">{t('verifying_subtitle')}</p>
          </>
        )}

        {state === 'generating' && (
          <>
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('generating_title')}</h1>
            <p className="text-sm text-gray-500">{t('generating_subtitle')}</p>
          </>
        )}

        {state === 'ready' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('ready_title')}</h1>
            <p className="text-sm text-gray-500 mb-6">{t('ready_subtitle')}</p>

            {downloadUrl && (
              <a
                href={downloadUrl}
                download={`resume.${format}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors mb-3"
              >
                <Download className="w-4 h-4" />
                {t('download_btn', { format: format.toUpperCase() })}
              </a>
            )}

            <Link
              href="/workspace"
              className="block text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t('back_to_workspace')}
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t('error_title')}</h1>
            <p className="text-sm text-red-500 mb-6">{error}</p>
            <Link
              href="/workspace"
              className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {t('back_to_workspace')}
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
