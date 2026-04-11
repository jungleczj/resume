'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/domain'

type NavKey = 'workspace' | 'achievements' | 'pricing' | 'settings'

interface NavItem {
  key: NavKey
  /** href when logged in */
  hrefAuth: string
  /** href when not logged in — null means hide item */
  hrefGuest: string | null
  authRequired: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'workspace',    hrefAuth: '/upload',   hrefGuest: '/',    authRequired: false },
  { key: 'achievements', hrefAuth: '/library',  hrefGuest: '/',    authRequired: false },
  { key: 'pricing',      hrefAuth: '/pricing',  hrefGuest: '/pricing', authRequired: false },
  { key: 'settings',     hrefAuth: '/settings', hrefGuest: null,   authRequired: true  },
]

export function NavBar() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [lastWorkspaceUrl, setLastWorkspaceUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
        setProfile(p)
      }
    })

    // Restore last workspace URL from localStorage
    // WorkspaceClient saves this on mount so the nav can link directly back
    const saved = localStorage.getItem('cf_last_workspace')
    if (saved) setLastWorkspaceUrl(saved)
  }, [])

  const isCNFree = !profile || profile.payment_market === 'cn_free'
  const isEN = locale === 'en-US'

  const toggleLocale = () => {
    router.replace(pathname, { locale: isEN ? 'zh-CN' : 'en-US' })
    setMobileMenuOpen(false)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    router.push('/')
  }

  // Resolve href for a nav item based on auth state
  const resolveHref = (item: NavItem): string | null => {
    if (!user) return item.hrefGuest
    // Workspace: use last visited workspace URL if available, otherwise upload
    if (item.key === 'workspace' && lastWorkspaceUrl) return lastWorkspaceUrl
    return item.hrefAuth
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.authRequired && !user) return false
    if (!user && item.hrefGuest === null) return false
    return true
  })

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-indigo-500/10 shadow-sm shadow-indigo-500/5">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0 mr-6 md:mr-10" onClick={() => setMobileMenuOpen(false)}>
          <span className="text-xl md:text-2xl font-extrabold tracking-tighter text-[#3525cd] font-headline">
            CareerFlow
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {visibleItems.map(item => {
            const href = resolveHref(item)
            if (!href) return null
            const isActive = pathname === (item.hrefAuth || item.hrefGuest) ||
              pathname.startsWith((item.hrefAuth || '') + '/')
            return (
              <Link
                key={item.key}
                href={href}
                className={cn(
                  'px-3 py-2 text-sm font-medium font-headline tracking-tight transition-all',
                  isActive
                    ? 'text-[#3525cd] font-semibold border-b-2 border-[#3525cd] pb-1.5 rounded-none'
                    : 'text-slate-500 hover:text-[#3525cd] hover:bg-indigo-50/60 rounded-lg'
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </div>

        {/* Desktop Right: Language + User */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-auto">
          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 transition-colors"
            aria-label="Toggle language"
          >
            <span className="material-symbols-outlined text-sm text-slate-500">language</span>
            <div className="flex items-center text-[10px] font-bold font-headline tracking-tighter">
              <span className={cn(isEN ? 'text-[#3525cd]' : 'text-slate-400')}>EN</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className={cn(!isEN ? 'text-[#3525cd]' : 'text-slate-400')}>中</span>
            </div>
          </button>

          {/* User area */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm hover:ring-2 hover:ring-[#3525cd]/20 transition-all overflow-hidden"
                aria-label="User menu"
              >
                {user.user_metadata?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.user_metadata.avatar_url as string}
                    alt="avatar"
                    className="w-full h-full object-cover rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="material-symbols-outlined text-slate-500 text-lg">person</span>
                )}
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200/60 rounded-2xl shadow-xl z-20 py-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {profile && (
                        <span className={cn(
                          'inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 font-bold',
                          isCNFree
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-[#3525cd]/10 text-[#3525cd]'
                        )}>
                          {isCNFree ? (isEN ? 'Free' : '免费版') : 'Pro'}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">settings</span>
                      {t('settings')}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">logout</span>
                      {t('logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 bg-[#3525cd] text-white text-sm font-bold font-headline rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[#3525cd]/20"
            >
              {t('login')}
            </Link>
          )}
        </div>

        {/* Mobile: Right controls */}
        <div className="md:hidden flex items-center gap-2 ml-auto">
          <button
            onClick={toggleLocale}
            className="text-[10px] font-bold font-headline text-slate-500 bg-slate-100 rounded-full px-2.5 py-1"
          >
            {isEN ? '中' : 'EN'}
          </button>
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-slate-600">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {visibleItems.map(item => {
              const href = resolveHref(item)
              if (!href) return null
              const isActive = pathname === (item.hrefAuth || item.hrefGuest) ||
                pathname.startsWith((item.hrefAuth || '') + '/')
              return (
                <Link
                  key={item.key}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-xl text-sm font-medium font-headline transition-all',
                    isActive
                      ? 'bg-[#3525cd]/8 text-[#3525cd] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {t(item.key)}
                </Link>
              )
            })}
            <div className="pt-2 border-t border-slate-100">
              {user ? (
                <>
                  <p className="px-4 py-2 text-xs text-slate-400 truncate">{user.email}</p>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {t('logout')}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 mx-2 py-3 bg-[#3525cd] text-white text-sm font-bold font-headline rounded-full"
                >
                  {t('login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
