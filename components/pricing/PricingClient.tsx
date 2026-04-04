'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

interface PricingClientProps {
  paywallSettings: Record<string, unknown>[]
  userId: string | null
}

type PlanKey = 'per_export' | 'monthly' | 'yearly'

const PLANS: { key: PlanKey; highlighted?: boolean }[] = [
  { key: 'per_export' },
  { key: 'monthly' },
  { key: 'yearly', highlighted: true }
]

const VALUE_PROPS = [
  { icon: 'auto_awesome', colorClass: 'bg-primary/10 text-primary', titleKey: 'Unlimited AI Optimization', descKey: 'Continuous refinement for every job description you target.' },
  { icon: 'verified_user', colorClass: 'bg-tertiary-container/10 text-tertiary', titleKey: 'Watermark-free Exports', descKey: 'Professional PDFs and Word docs for high-stakes applications.' },
  { icon: 'grid_view', colorClass: 'bg-secondary/10 text-secondary', titleKey: 'All Templates Unlocked', descKey: 'Full library of ATS-optimized designs for any industry.' },
]

export function PricingClient({ paywallSettings: _settings, userId }: PricingClientProps) {
  const t = useTranslations()
  const locale = useLocale()
  const [selected, setSelected] = useState<PlanKey>('monthly')
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)
    await trackEvent('payment_initiated', { plan_type: selected, user_id: userId })
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: selected, user_id: userId })
      })
      const { checkout_url, error } = await res.json()
      if (error) throw new Error(error)
      if (checkout_url) window.location.href = checkout_url
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }

  const isZH = locale === 'zh-CN'

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12 items-start">

          {/* Left: Value propositions */}
          <div className="lg:col-span-5 space-y-12 py-8">
            <div className="space-y-5">
              <h1 className="font-headline text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-on-surface">
                {isZH ? (
                  <>解锁你的<br /><span className="text-primary">{t('pricing.title')}</span></>
                ) : (
                  <>Unlock Your <br /><span className="text-primary">Career Potential</span></>
                )}
              </h1>
              <p className="text-lg text-on-surface-variant max-w-md leading-relaxed">
                {isZH
                  ? '加入超过 50,000 名职场人，用 CareerFlow AI 成功拿到顶级 offer。'
                  : 'Join over 50,000 professionals who used CareerFlow AI to land roles at top-tier firms.'}
              </p>
            </div>

            <div className="space-y-8">
              {VALUE_PROPS.map((vp, i) => (
                <div key={i} className="flex gap-5 group">
                  <div className={cn('flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform', vp.colorClass)}>
                    <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{vp.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface mb-1">{vp.titleKey}</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{vp.descKey}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI tip */}
            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-tertiary-container/10 border border-tertiary-container/20">
              <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <p className="text-sm font-medium text-on-tertiary-fixed-variant">
                {isZH
                  ? 'Pro 用户获得面试回复率是普通用户的 3 倍'
                  : 'Pro users get 3x more interview callbacks with premium templates'}
              </p>
            </div>
          </div>

          {/* Right: Pricing cards */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="grid md:grid-cols-3 gap-4 items-stretch">
              {PLANS.map(({ key, highlighted }) => {
                const plan = t.raw(`pricing.${key}`) as {
                  name: string; price: string; period: string; desc: string
                  features: string[]; not_included?: string[]; badge?: string
                }
                const isSelected = selected === key

                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={cn(
                      'relative text-left p-8 rounded-xl flex flex-col shadow-sm hover:shadow-xl transition-all duration-300 border min-h-[540px]',
                      highlighted
                        ? 'ring-2 ring-[#4f46e5] border-[#4f46e5]/20 bg-surface-container-lowest'
                        : 'border-outline-variant/10 bg-surface-container-lowest',
                      isSelected && !highlighted && 'ring-2 ring-primary/40'
                    )}
                  >
                    {/* Best Value badge */}
                    {plan.badge && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold text-on-primary shadow-md" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}>
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{plan.name}</span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-on-surface font-headline">{plan.price}</span>
                        <span className="text-on-surface-variant text-sm">{plan.period}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1">{plan.desc}</p>
                    </div>

                    <ul className="space-y-4 flex-grow">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                          <span className="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
                          <span>{f}</span>
                        </li>
                      ))}
                      {plan.not_included?.map((f, i) => (
                        <li key={`x-${i}`} className="flex items-start gap-2 text-sm text-outline">
                          <span className="material-symbols-outlined text-outline text-lg mt-0.5">cancel</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            {/* CTA */}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 rounded-full text-on-primary font-bold text-base shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('pricing.cta')}
            </button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 text-xs text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">lock</span>
                <span>{isZH ? '安全加密支付' : 'Secure checkout'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">refresh</span>
                <span>{isZH ? '随时取消' : 'Cancel anytime'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">verified</span>
                <span>{isZH ? '14 天退款保障' : '14-day money back'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
