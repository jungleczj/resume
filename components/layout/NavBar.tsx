'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export function NavBar() {
  const t = useTranslations()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display font-bold text-lg text-gray-900">
            CareerFlow
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">
            {t('brand.tagline')}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/workspace"
              className="text-sm font-medium text-brand hover:text-brand-700"
            >
              进入工作台
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
