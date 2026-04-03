'use client'

import { useState } from 'react'
import { X, Download, Loader2, FileText, File } from 'lucide-react'
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
  format: initialFormat,
  anonymousId,
  userId,
  profile,
  onClose
}: ExportModalProps) {
  const [format, setFormat] = useState<'pdf' | 'docx'>(initialFormat)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCNFree = !profile || profile.payment_market === 'cn_free'

  const handleExport = async () => {
    setExporting(true)
    setError(null)

    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format,
      market: isCNFree ? 'cn_free' : 'en_paid'
    })

    try {
      const res = await fetch('/api/resume/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          anonymous_id: anonymousId,
          user_id: userId
        })
      })

      if (res.status === 402) {
        // EN user hits paywall — redirect to Creem checkout
        const { checkout_url } = await res.json()
        if (checkout_url) {
          window.location.href = checkout_url
        }
        return
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Export failed')
      }

      // Download the file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resume.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await trackEvent('export_completed', {
        anonymous_id: anonymousId,
        format,
        market: isCNFree ? 'cn_free' : 'en_paid'
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">导出简历</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format selection */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">选择格式</p>
          <div className="grid grid-cols-2 gap-2">
            {(['pdf', 'docx'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all',
                  format === f
                    ? 'border-brand bg-brand-50 text-brand'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {f === 'pdf' ? (
                  <FileText className="w-6 h-6" />
                ) : (
                  <File className="w-6 h-6" />
                )}
                <span className="text-sm font-medium">
                  {f === 'pdf' ? 'PDF' : 'Word'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* EN paywall notice */}
        {!isCNFree && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              首次导出需要解锁。支持信用卡支付，安全加密。
            </p>
          </div>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500 text-center">{error}</p>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exporting
            ? '生成中...'
            : isCNFree
            ? `导出 ${format.toUpperCase()}`
            : '解锁并导出'}
        </button>

        {isCNFree && (
          <p className="mt-2 text-xs text-gray-400 text-center">免费导出</p>
        )}
      </div>
    </div>
  )
}
