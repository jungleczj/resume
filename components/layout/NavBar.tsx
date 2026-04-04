'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/domain'

export function NavBar() {
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
  }, [])

  const isCNFree = !profile || profile.payment_market === 'cn_free'

  const navItems = [
    { key: 'workspace', href: '/workspace', label: t('nav.workspace'), show: true },
    { key: 'library', href: '/library', label: t('nav.library'), show: !!user },
    { key: 'pricing', href: '/pricing', label: t('nav.pricing'), show: !user || !isCNFree },
    { key: 'settings', href: '/settings', label: t('nav.settings'), show: !!user },
  ]

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-indigo-500/10 shadow-sm shadow-indigo-500/5">
      <div className="max-w-screen-2xl mx-auto px-8 h-20 flex items-center">
        {/* Logo + Nav Links */}
        <div className="flex items-center gap-8 flex-1">
          <Link href="/" className="flex-shrink-0">
            <span className="text-2xl font-extrabold tracking-tighter text-[#4F46E5] font-headline">
              CareerFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.filter(i => i.show).map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'px-3 py-2 text-sm font-medium font-headline tracking-tight rounded-lg transition-all',
                    isActive
                      ? 'text-[#4F46E5] font-bold border-b-2 border-[#4F46E5] rounded-none pb-1'
                      : 'text-slate-500 hover:text-[#4F46E5] hover:bg-indigo-50/50 rounded-lg'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Language + User */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Language pill */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 bg-surface-container-high rounded-full px-3 py-1.5 hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-on-surface-variant">language</span>
            <div className="flex items-center text-[10px] font-bold font-headline tracking-tighter">
              <span className={cn(isEN ? 'text-primary' : 'text-on-surface-variant hover:text-primary cursor-pointer transition-colors')}>EN</span>
              <span className="mx-1 text-outline-variant/50">|</span>
              <span className={cn(!isEN ? 'text-primary' : 'text-on-surface-variant hover:text-primary cursor-pointer transition-colors')}>中</span>
            </div>
          </button>

          {/* User area */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border-2 border-white shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-lg">person</span>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-outline-variant/20 rounded-2xl shadow-xl z-20 py-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                      {profile && (
                        <span className={cn(
                          'inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 font-bold',
                          isCNFree
                            ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-primary/10 text-primary'
                        )}>
                          {isCNFree ? '免费版' : 'Pro'}
                        </span>
                      )}
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
              className="px-5 py-2 bg-primary text-on-primary text-sm font-bold font-headline rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
