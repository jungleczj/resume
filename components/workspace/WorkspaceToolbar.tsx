'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { trackEvent } from '@/lib/analytics'
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
  const {
    resumeLang,
    setResumeLang,
    showPhoto,
    togglePhoto,
    isGenerating,
    jdText,
    setIsGenerating
  } = useWorkspaceStore()

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const isEN = locale === 'en-US'
  const isCNFree = !profile || profile.payment_market === 'cn_free'

  const toggleLocale = () => {
    const next = isEN ? 'zh-CN' : 'en-US'
    router.replace(pathname, { locale: next })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jdText,
          anonymous_id: anonymousId,
          user_id: userId,
          resume_lang: resumeLang
        })
      })
      if (!res.ok) throw new Error('Generation failed')
      const { data } = await res.json()
      if (data?.editor_json) {
        useWorkspaceStore.getState().setEditorJson(data.editor_json)
      }
      await trackEvent('resume_generated', {
        anonymous_id: anonymousId,
        has_jd: jdText.length > 0,
        resume_lang: resumeLang
      })
    } catch {
      // handled by UI state
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = async () => {
    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format: 'pdf',
      has_jd: jdText.length > 0,
      has_photo: showPhoto
    })
    if (profile?.payment_market === 'en_paid') {
      window.dispatchEvent(new CustomEvent('cf:paywall', { detail: { format: 'pdf' } }))
      return
    }
    window.dispatchEvent(new CustomEvent('cf:export', { detail: { format: 'pdf' } }))
  }

  const handlePhotoToggle = () => {
    togglePhoto()
    trackEvent('photo_toggled', {
      anonymous_id: anonymousId,
      state: !showPhoto ? 'on' : 'off'
    })
  }

  const navItems = [
    { key: 'workspace', href: '/workspace', label: t('nav.workspace'), show: true },
    { key: 'library', href: '/library', label: t('nav.library'), show: !!userId },
    { key: 'pricing', href: '/pricing', label: t('nav.pricing'), show: !userId || !isCNFree },
    { key: 'settings', href: '/settings', label: t('nav.settings'), show: !!userId },
  ]

  return (
    <header className="flex-shrink-0 bg-white/60 backdrop-blur-xl border-b border-indigo-500/10 shadow-sm shadow-indigo-500/5 z-50">
      <div className="flex justify-between items-center w-full px-8 h-20 max-w-screen-2xl mx-auto">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
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
                    'px-3 py-2 text-sm font-medium font-headline tracking-tight transition-all',
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

        {/* Center: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold font-headline text-on-primary shadow-md shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all',
              isGenerating && 'opacity-60 cursor-not-allowed'
            )}
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            )}
            {t('workspace.toolbar.generate')}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant text-on-surface text-sm font-bold font-headline rounded-full hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-base">download</span>
            {t('workspace.toolbar.export')}
          </button>

          {/* History */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('cf:history'))}
            className="flex items-center gap-1.5 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all"
            title={t('workspace.toolbar.history')}
          >
            <span className="material-symbols-outlined text-xl">history</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-outline-variant/30 mx-1" />

          {/* Language toggle */}
          <button
            className="flex items-center border border-outline-variant rounded-lg overflow-hidden text-xs"
            title={t('workspace.toolbar.language')}
          >
            {(['zh', 'en'] as const).map(lang => (
              <span
                key={lang}
                onClick={() => setResumeLang(lang)}
                className={cn(
                  'px-2.5 py-1.5 font-bold font-headline transition-colors cursor-pointer',
                  resumeLang === lang
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                )}
              >
                {lang === 'zh' ? '中' : 'EN'}
              </span>
            ))}
          </button>

          {/* Photo toggle */}
          <button
            onClick={handlePhotoToggle}
            title={t('workspace.toolbar.photo')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-all',
              showPhoto
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            <span className="material-symbols-outlined text-base">
              {showPhoto ? 'photo_camera' : 'photo_camera_off'}
            </span>
          </button>

          {/* Save */}
          <button
            className="flex items-center gap-1 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all"
            title={t('workspace.toolbar.save')}
          >
            <span className="material-symbols-outlined text-xl">save</span>
          </button>
        </div>

        {/* Right: Language + User */}
        <div className="flex items-center gap-3">
          {/* App language pill */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 bg-surface-container-high rounded-full px-3 py-1.5 hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-on-surface-variant">language</span>
            <div className="flex items-center text-[10px] font-bold font-headline tracking-tighter">
              <span className={cn(isEN ? 'text-primary' : 'text-on-surface-variant')}>EN</span>
              <span className="mx-1 text-outline-variant/50">|</span>
              <span className={cn(!isEN ? 'text-primary' : 'text-on-surface-variant')}>中</span>
            </div>
          </button>

          {/* User avatar */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border-2 border-white shadow-sm hover:ring-2 hover:ring-primary/20 transition-all overflow-hidden"
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
              className="px-4 py-1.5 text-sm font-bold font-headline text-on-primary rounded-full transition-all shadow-md shadow-primary/20 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
