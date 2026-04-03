'use client'

import { useTranslations } from 'next-intl'
import { Archive, Zap, Clock } from 'lucide-react'

const FEATURE_ICONS = [Archive, Zap, Clock]

export function FeatureCards() {
  const t = useTranslations()

  const features = [
    {
      key: 'achievement_bank',
      Icon: FEATURE_ICONS[0],
      color: 'text-green-600 bg-green-50'
    },
    {
      key: 'one_click_resume',
      Icon: FEATURE_ICONS[1],
      color: 'text-brand bg-brand-50'
    },
    {
      key: 'always_ready',
      Icon: FEATURE_ICONS[2],
      color: 'text-purple-600 bg-purple-50'
    }
  ] as const

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
      {features.map(({ key, Icon, color }) => (
        <div
          key={key}
          className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-display font-semibold text-gray-900 mb-2">
            {t(`landing.features.${key}.title`)}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t(`landing.features.${key}.desc`)}
          </p>
        </div>
      ))}
    </div>
  )
}
