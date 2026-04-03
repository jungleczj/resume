'use client'

import { useTranslations } from 'next-intl'
import { trackEvent } from '@/lib/analytics'

export function NotionConnectButton() {
  const t = useTranslations()

  const handleConnect = () => {
    trackEvent('notion_connect_clicked')
    // F2 flow: requires login, handled server-side
    window.location.href = '/api/notion/oauth'
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-5 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:border-gray-400 hover:bg-gray-50 transition-all text-sm"
    >
      <NotionIcon />
      {t('landing.hero.cta_notion')}
    </button>
  )
}

function NotionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="15" fill="black" />
      <path
        d="M23 18.4c3.1 2.6 4.3 2.4 10.2 2l55.5-3.3c1.2 0 .2-1.2-.3-1.4l-9.3-6.7c-1.7-1.3-4-2.8-8.4-2.4L18.4 10.3c-2 .2-2.4 1.2-1.6 2l6.2 6.1zm2.6 10.8v58.3c0 3.1 1.5 4.3 5 4.1l60.5-3.5c3.5-.2 4.4-2.2 4.4-4.8V25.5c0-2.6-1-4-3.2-3.8l-63.5 3.7c-2.4.1-3.2 1.4-3.2 3.8zm59 2.4c.4 1.7 0 3.4-1.7 3.6l-2.8.5V79c-2.4 1.3-4.7 2-6.6 2-3.1 0-3.8-.9-6.1-3.7l-18.6-29.2V76.3l5.9 1.3s0 3.4-4.7 3.4L39.6 82c-.4-1.7 0-3.4 1.9-3.9l5-1.3V38.9L40.4 38c-.4-1.7.5-4.1 3.2-4.3L61 32.6l19.4 30.3V35.5l-5-1c-.4-2 1-3.5 2.8-3.7l13.4-.8z"
        fill="white"
      />
    </svg>
  )
}
