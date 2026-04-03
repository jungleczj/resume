'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { trackEvent } from '@/lib/analytics'
import { UploadZone } from '@/components/landing/UploadZone'
import { NotionConnectButton } from '@/components/landing/NotionConnectButton'
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
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {t('landing.hero.title')}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 mb-3">
            <UploadZone onSuccess={handleUploadSuccess} />
            <NotionConnectButton />
          </div>
          <p className="text-sm text-gray-400">
            {t('landing.hero.upload_hint')}
          </p>
        </div>

        {/* Feature cards */}
        <FeatureCards />
      </main>
    </div>
  )
}
