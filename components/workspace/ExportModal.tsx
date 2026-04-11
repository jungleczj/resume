'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, FileText, Download, Loader2, Check, LogIn } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace'
import { useRouter } from '@/lib/i18n/navigation'
import type { Profile } from '@/lib/types/domain'

interface ExportModalProps {
  format: 'pdf' | 'docx'
  anonymousId: string
  userId: string | null
  profile: Profile | null
  onClose: () => void
}

type Plan = 'one_time' | 'monthly' | 'yearly'
type Format = 'pdf' | 'docx'

interface Prices {
  one_time: number
  monthly: number
  yearly: number
}

export function ExportModal({
  format: initialFormat,
  anonymousId,
  userId,
  profile,
  onClose
}: ExportModalProps) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()

  // Pull the current in-session resume state from the store
  const {
    resumePersonalInfo,
    resumeEducation,
    resumeSkills,
    resumeCertifications,
    resumeLanguages,
    resumeAwards,
    resumePublications,
    experiences,
    showPhoto,
    photoPath,
    resumeLang,
  } = useWorkspaceStore()

  // CRITICAL: payment decision uses ONLY payment_market, never geo
  const isCNFree = !profile || profile.payment_market === 'cn_free'

  const [selectedFormat, setSelectedFormat] = useState<Format>(initialFormat)
  const [selectedPlan, setSelectedPlan] = useState<Plan>('one_time')
  const [prices, setPrices] = useState<Prices>({ one_time: 4.99, monthly: 9.9, yearly: 79 })
  const [hasAccess, setHasAccess] = useState<boolean | null>(isCNFree ? true : null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  // After successful export for non-logged-in users, show login prompt
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Fetch real-time prices and access status for EN users
  useEffect(() => {
    if (isCNFree) return
    const load = async () => {
      const [priceRes, accessRes] = await Promise.all([
        fetch('/api/paywall-config'),
        fetch('/api/payment/check-access')
      ])
      if (priceRes.ok) {
        const data = await priceRes.json() as Prices
        setPrices(data)
      }
      if (accessRes.ok) {
        const data = await accessRes.json() as { has_access: boolean }
        setHasAccess(data.has_access)
      }
    }
    load()
  }, [isCNFree])

  const handleDirectDownload = async () => {
    setExporting(true)
    setError(null)

    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format: selectedFormat,
      market: isCNFree ? 'cn_free' : 'en_paid'
    })

    try {
      const res = await fetch('/api/resume/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: selectedFormat,
          anonymous_id: anonymousId,
          user_id: userId,
          // Send current store state so export reflects in-session edits
          resumeData: {
            personalInfo: resumePersonalInfo,
            education: resumeEducation,
            skills: resumeSkills,
            certifications: resumeCertifications,
            spokenLanguages: resumeLanguages,
            awards: resumeAwards,
            publications: resumePublications,
            experiences,
            showPhoto,
            photoPath,
            lang: resumeLang,
          }
        })
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Build filename: 姓名_职位_日期.format
      const safeName = (resumePersonalInfo?.name ?? 'Resume').replace(/[/\\?%*:|"<>]/g, '_')
      const jobTitle = experiences.find(e => (e.achievements ?? []).some(a => a.status === 'confirmed'))?.job_title ?? ''
      const safeTitle = jobTitle.replace(/[/\\?%*:|"<>]/g, '_')
      const dateStr = new Date().toISOString().slice(0, 7) // 2026-04
      const filename = [safeName, safeTitle, dateStr].filter(Boolean).join('_') + `.${selectedFormat}`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await trackEvent('export_completed', {
        anonymous_id: anonymousId,
        format: selectedFormat,
        market: isCNFree ? 'cn_free' : 'en_paid'
      })

      // For anonymous (not logged in) users, prompt them to login after export
      if (!userId) {
        setShowLoginPrompt(true)
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handlePayNow = async () => {
    setPaymentLoading(true)
    setError(null)

    await trackEvent('payment_initiated', {
      anonymous_id: anonymousId,
      plan_type: selectedPlan,
      format: selectedFormat
    })

    try {
      const res = await fetch('/api/payment/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: selectedPlan,
          format: selectedFormat
        })
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to start checkout')
      }

      const { checkout_url } = await res.json() as { checkout_url: string }
      window.location.href = checkout_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setPaymentLoading(false)
    }
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
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post-export login prompt — shown to anonymous users after successful download */}
        {showLoginPrompt ? (
          <div className="px-6 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {locale === 'en-US' ? 'Resume downloaded!' : '简历已下载！'}
            </h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              {locale === 'en-US'
                ? 'Sign in to save your resume and achievements for future use.'
                : '登录后可永久保存您的简历和成就记录，下次无需重新上传。'}
            </p>
            <button
              onClick={() => {
                onClose()
                router.push('/login')
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#3525cd] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity mb-2"
            >
              <LogIn className="w-4 h-4" />
              {locale === 'en-US' ? 'Sign in to save' : '登录保存'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {locale === 'en-US' ? 'Maybe later' : '稍后再说'}
            </button>
          </div>
        ) : (

        <div className="px-6 py-5">
          {/* Format selector — shown for all users */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('export.format_label')}
            </p>
            <div className="flex gap-2">
              {(['pdf', 'docx'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    selectedFormat === fmt
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  {fmt === 'pdf' ? 'PDF' : 'Word'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          {/* CN free or already subscribed: direct download */}
          {(isCNFree || hasAccess === true) && (
            <button
              onClick={handleDirectDownload}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t('export.processing')}</>
              ) : (
                <><Download className="w-4 h-4" />{t('export.download_btn')}</>
              )}
            </button>
          )}

          {/* EN paid, loading access check */}
          {!isCNFree && hasAccess === null && (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {/* EN paid, no subscription: plan selector + Pay Now */}
          {!isCNFree && hasAccess === false && (
            <PlanSelector
              selectedPlan={selectedPlan}
              prices={prices}
              onSelectPlan={setSelectedPlan}
              onPayNow={handlePayNow}
              loading={paymentLoading}
              t={t}
            />
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function PlanSelector({
  selectedPlan,
  prices,
  onSelectPlan,
  onPayNow,
  loading,
  t
}: {
  selectedPlan: Plan
  prices: Prices
  onSelectPlan: (p: Plan) => void
  onPayNow: () => void
  loading: boolean
  t: ReturnType<typeof useTranslations>
}) {
  const plans: Array<{ key: Plan; label: string; price: string; desc: string; badge?: string }> = [
    {
      key: 'one_time',
      label: t('export.plan_one_time'),
      price: `$${prices.one_time.toFixed(2)}`,
      desc: t('export.plan_one_time_desc')
    },
    {
      key: 'monthly',
      label: t('export.plan_monthly'),
      price: `$${prices.monthly.toFixed(2)}/mo`,
      desc: t('export.plan_monthly_desc'),
      badge: t('export.plan_recommended')
    },
    {
      key: 'yearly',
      label: t('export.plan_yearly'),
      price: `$${prices.yearly.toFixed(0)}/yr`,
      desc: t('export.plan_yearly_desc')
    }
  ]

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {t('export.plan_label')}
      </p>

      <div className="space-y-2 mb-5">
        {plans.map(plan => (
          <button
            key={plan.key}
            onClick={() => onSelectPlan(plan.key)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
              selectedPlan === plan.key
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            {/* Radio dot */}
            <div className={cn(
              'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              selectedPlan === plan.key ? 'border-indigo-600' : 'border-gray-300'
            )}>
              {selectedPlan === plan.key && (
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{plan.label}</span>
                {plan.badge && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{plan.desc}</p>
            </div>
            <span className="text-sm font-bold text-gray-900 flex-shrink-0">{plan.price}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onPayNow}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{t('export.processing')}</>
        ) : (
          <>{t('export.pay_now')} →</>
        )}
      </button>

      <p className="text-center text-[11px] text-gray-400 mt-3 flex items-center justify-center gap-1">
        <Check className="w-3 h-3 text-gray-400" />
        {t('export.pay_secure')}
      </p>
    </div>
  )
}
