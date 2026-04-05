'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { JDPanel } from './JDPanel'
import { AchievementPanel } from './AchievementPanel'
import { ResumePreview } from './ResumePreview'
import { ExportModal } from './ExportModal'
import { VersionHistorySidebar } from './VersionHistorySidebar'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { WorkExperience, Profile, ResumeVersion } from '@/lib/types/domain'
import type { ResumeInfo } from '@/store/workspace'

interface WorkspaceClientProps {
  experiences: WorkExperience[]
  anonymousId: string
  userId: string | null
  profile: Profile | null
  locale: string
}

const SIDEBAR_ITEMS = [
  { key: 'workspace', icon: 'edit_note', href: '/workspace' },
  { key: 'library', icon: 'emoji_events', href: '/library' },
  { key: 'drafts', icon: 'description', href: '/library?tab=drafts' },
  { key: 'settings', icon: 'settings', href: '/settings' },
]

export function WorkspaceClient({
  experiences,
  anonymousId,
  userId,
  profile,
  locale: _locale
}: WorkspaceClientProps) {
  const {
    setExperiences,
    setResumeLang,
    togglePhoto,
    showPhoto,
    setAnonymousId,
    setUserId,
    setProfile,
    setEditorJson,
    setResumeInfo,
    editorJson
  } = useWorkspaceStore()

  const pathname = usePathname()

  const [parseStatus, setParseStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | 'not_found'
  >(experiences.length > 0 ? 'completed' : 'pending')

  // Separate state for overlay visibility to ensure it disappears when parsing completes
  const [showParsingOverlay, setShowParsingOverlay] = useState(
    experiences.length === 0 ? true : false
  )

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf')
  const [showHistory, setShowHistory] = useState(false)

  // Resizable left panel (JD + achievements)
  const [leftWidth, setLeftWidth] = useState(380)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(380)

  // Init store
  useEffect(() => {
    setAnonymousId(anonymousId)
    setUserId(userId)
    setProfile(profile)
    setExperiences(experiences)
    if (profile) {
      setResumeLang(profile.resume_lang_preference)
      if (profile.payment_market === 'cn_free' && !showPhoto) togglePhoto()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll parse status until completed
  const pollParseStatus = useCallback(async () => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)
    const res = await fetch(`/api/resume/parse-status?${params}`)
    if (!res.ok) return
    const { status } = await res.json()
    setParseStatus(status)
    return status
  }, [anonymousId, userId])

  const refreshExperiences = useCallback(async () => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)
    const res = await fetch(`/api/resume/experiences?${params}`)
    if (!res.ok) return
    const { data } = await res.json()
    if (data) setExperiences(data)
  }, [anonymousId, userId, setExperiences])

  const refreshResumeInfo = useCallback(async () => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)
    const res = await fetch(`/api/resume/upload-info?${params}`)
    if (!res.ok) return
    const { data } = await res.json()
    if (data?.parsedInfo) {
      setResumeInfo(data.parsedInfo as ResumeInfo)
    }
  }, [anonymousId, userId, setResumeInfo])

  useEffect(() => {
    if (parseStatus === 'completed') return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const status = await pollParseStatus()
      if (status === 'completed') {
        clearInterval(interval)
        setShowParsingOverlay(false)
        await refreshExperiences()
        await refreshResumeInfo()
      } else if (status === 'failed' || attempts >= 30) {
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Export/paywall events from toolbar
  useEffect(() => {
    const handlePaywall = (e: Event) => {
      setExportFormat((e as CustomEvent).detail?.format ?? 'pdf')
      setShowExportModal(true)
    }
    const handleExport = (e: Event) => {
      setExportFormat((e as CustomEvent).detail?.format ?? 'pdf')
      setShowExportModal(true)
    }
    window.addEventListener('cf:paywall', handlePaywall)
    window.addEventListener('cf:export', handleExport)
    return () => {
      window.removeEventListener('cf:paywall', handlePaywall)
      window.removeEventListener('cf:export', handleExport)
    }
  }, [])

  // History button from toolbar
  useEffect(() => {
    const handleHistory = () => setShowHistory(v => !v)
    window.addEventListener('cf:history', handleHistory)
    return () => window.removeEventListener('cf:history', handleHistory)
  }, [])

  // Resizable divider
  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = leftWidth
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStartX.current
      setLeftWidth(Math.max(280, Math.min(600, dragStartWidth.current + delta)))
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleRestoreVersion = (version: ResumeVersion) => {
    if (version.editor_json) setEditorJson(version.editor_json)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      {/* Top nav bar — matches glassmorphism NavBar */}
      <WorkspaceToolbar anonymousId={anonymousId} userId={userId} profile={profile} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar navigation (fixed width, collapsible on mobile) */}
        <aside className="hidden md:flex flex-col flex-shrink-0 w-20 lg:w-64 bg-slate-50 border-r border-slate-100 py-8 px-4 z-10">
          <div className="space-y-1 flex-1">
            {SIDEBAR_ITEMS.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href.split('?')[0] + '/')
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-xs uppercase tracking-widest font-bold font-headline',
                    isActive
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                  )}
                >
                  <span className="material-symbols-outlined text-xl flex-shrink-0">{item.icon}</span>
                  <span className="hidden lg:block">{item.key.charAt(0).toUpperCase() + item.key.slice(1)}</span>
                </Link>
              )
            })}
          </div>

          {/* Upgrade prompt — show for free users */}
          {(!profile || profile.payment_market === 'cn_free') && (
            <div className="mt-auto p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl hidden lg:block">
              <p className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-1">CareerFlow AI</p>
              <p className="text-on-surface font-headline font-bold text-sm mb-3">Upgrade to Pro</p>
              <Link
                href="/pricing"
                className="block w-full py-2 bg-on-surface text-surface text-xs font-bold rounded-lg hover:bg-primary transition-colors text-center"
              >
                Go Premium
              </Link>
            </div>
          )}
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Parse overlay - auto-dismisses when parse completes */}
          {showParsingOverlay && (
            <div className="absolute inset-0 z-20 bg-surface/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">100%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface font-headline">AI 正在提炼成就...</p>
                <p className="text-xs text-on-surface-variant mt-1">通常需要 10–30 秒，请稍候</p>
              </div>
              {/* Auto-progress bar that completes */}
              <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-primary transition-all duration-1000 ease-out"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {parseStatus === 'failed' && (
            <div className="absolute inset-0 z-20 bg-surface/85 backdrop-blur-sm flex items-center justify-center">
              <p className="text-sm font-semibold text-error">解析失败，请返回首页重新上传</p>
            </div>
          )}

          {/* Left content panel (JD + achievements) — resizable */}
          <div
            className="flex flex-col border-r border-outline-variant/10 bg-surface-container-low flex-shrink-0"
            style={{ width: leftWidth }}
          >
            <JDPanel />
            {/* Horizontal divider between JD and achievements */}
            <div className="h-1 bg-surface-container cursor-row-resize flex items-center justify-center hover:bg-primary/20 transition-colors">
              <div className="w-8 h-1 rounded-full bg-outline-variant/30" />
            </div>
            <AchievementPanel />
          </div>

          {/* Vertical resizable divider */}
          <div
            className="w-1.5 bg-outline-variant/20 hover:bg-primary/40 cursor-col-resize transition-colors flex-shrink-0 active:bg-primary/60"
            onMouseDown={onDividerMouseDown}
          />

          {/* Resume preview */}
          <div className="flex-1 overflow-auto bg-surface">
            <ResumePreview anonymousId={anonymousId} userId={userId} />
          </div>

          {/* Version history sidebar */}
          <VersionHistorySidebar
            anonymousId={anonymousId}
            userId={userId}
            currentJson={editorJson}
            open={showHistory}
            onClose={() => setShowHistory(false)}
            onRestore={handleRestoreVersion}
          />
        </div>
      </div>

      {showExportModal && (
        <ExportModal
          format={exportFormat}
          anonymousId={anonymousId}
          userId={userId}
          profile={profile}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  )
}
