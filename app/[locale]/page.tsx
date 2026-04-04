'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { trackEvent } from '@/lib/analytics'
import { UploadZone } from '@/components/landing/UploadZone'
import { FeatureCards } from '@/components/landing/FeatureCards'
import { NavBar } from '@/components/layout/NavBar'

export default function LandingPage() {
  const t = useTranslations()
  const router = useRouter()

  const handleUploadSuccess = (anonymousId: string) => {
    trackEvent('f1_upload_completed', { anonymous_id: anonymousId })
    router.push(`/workspace?anonymous_id=${anonymousId}`)
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <NavBar />

      <main className="max-w-[1024px] mx-auto px-6 pt-24 pb-16">
        {/* Hero Section */}
        <section className="mb-12">
          <h1 className="text-5xl font-extrabold text-on-surface tracking-tight mb-4 font-headline">
            {t('landing.hero.title')}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed mb-10">
            {t('landing.hero.subtitle')}
          </p>

          {/* Upload zone */}
          <UploadZone
            onSuccess={handleUploadSuccess}
            onNotionClick={() => router.push('/login')}
          />
        </section>

        {/* AI progress indicator */}
        <div className="mt-8 flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
          <div className="w-10 h-10 rounded-full bg-tertiary-container/10 flex items-center justify-center text-on-tertiary-fixed-variant flex-shrink-0">
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-on-surface">{t('landing.ai_ready')}</span>
              <span className="text-xs font-bold text-tertiary">{t('landing.ai_match')}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full rounded-full w-0" style={{ background: 'linear-gradient(90deg, #7e3000, #a44100)' }} />
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20">
          <FeatureCards />
        </div>
      </main>
    </div>
  )
}
