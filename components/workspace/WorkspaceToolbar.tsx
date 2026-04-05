'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/domain'

interface WorkspaceToolbarProps {
  anonymousId: string
  userId: string | null
  profile: Profile | null
}

export function WorkspaceToolbar({
  anonymousId,
  userId,
  profile
}: WorkspaceToolbarProps) {
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const isEN = locale === 'en-US'

  const toggleLocale = () => {
    const next = isEN ? 'zh-CN' : 'en-US'
    router.replace(pathname, { locale: next })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = [
    { key: 'resumes',      href: '/library',   label: t('nav.resumes'),      show: true },
    { key: 'workspace',    href: '/workspace', label: t('nav.workspace'),    show: true },
    { key: 'achievements', href: '/library',   label: t('nav.achievements'), show: true },
    { key: 'pricing',      href: '/pricing',   label: t('nav.pricing'),      show: true },
    { key: 'settings',     href: '/settings',  label: t('nav.settings'),     show: !!userId },
  ]

  return (
    <header className="flex-shrink-0 bg-white/60 backdrop-blur-xl border-b border-slate-100/50 shadow-sm shadow-indigo-500/5 z-50">
      <div className="flex justify-between items-center w-full px-8 h-20 max-w-screen-2xl mx-auto">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-12">
          <Link href="/" className="flex-shrink-0">
            <span className="text-2xl font-bold tracking-tighter text-indigo-700 font-headline">
              CareerFlow
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 font-headline tracking-tight">
            {navItems.filter(i => i.show).map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 pb-1'
                      : 'text-slate-600 hover:text-indigo-600'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: notifications + help + language + user */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all duration-200">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all duration-200">
            <span className="material-symbols-outlined">help</span>
          </button>

          {/* App language pill */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 transition-colors group"
          >
            <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-indigo-600">language</span>
            <div className="flex items-center text-[10px] font-bold font-headline tracking-tighter text-slate-600">
              <span className={cn(isEN ? 'text-indigo-600' : 'hover:text-indigo-600 cursor-pointer')}>EN</span>
              <span className="mx-0.5 text-slate-400"> | </span>
              <span className={cn(!isEN ? 'text-indigo-600' : 'hover:text-indigo-600 cursor-pointer')}>中</span>
            </div>
          </button>

          {/* User avatar */}
          {user ? (
            <div className="relative ml-2">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-100 cursor-pointer active:scale-95 transition-transform duration-150 bg-surface-container-highest flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-lg">person</span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-outline-variant/20 rounded-2xl shadow-xl z-20 py-1">
                    <div className="px-4 py-3 border-b border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-on-surface-variant">logout</span>
                      {t('nav.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-2 px-4 py-1.5 text-sm font-bold font-headline text-on-primary rounded-full transition-all shadow-md shadow-primary/20 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #5b4de8 0%, #3525cd 100%)' }}
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
