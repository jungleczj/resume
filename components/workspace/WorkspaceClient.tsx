'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { JDPanel } from './JDPanel'
import { AchievementPanel } from './AchievementPanel'
import { ResumePreview } from './ResumePreview'
import { ExportModal } from './ExportModal'
import { VersionHistorySidebar } from './VersionHistorySidebar'
import { Link, usePathname } from '@/lib/i18n/navigation'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { WorkExperience, Profile, ResumeVersion, ResumePersonalInfo, ResumeEducation, ResumeSkillGroup } from '@/lib/types/domain'

interface WorkspaceClientProps {
  experiences: WorkExperience[]
  anonymousId: string
  userId: string | null
  profile: Profile | null
  locale: string
  initialParseStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  initialParsedData?: {
    personal_info: ResumePersonalInfo | null
    education: ResumeEducation[]
    skills: ResumeSkillGroup[]
  } | null
  initialPhotoPath?: string | null
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
  locale: _locale,
  initialParseStatus,
  initialParsedData,
  initialPhotoPath
}: WorkspaceClientProps) {
  const {
    setExperiences,
    resumeLang,
    setResumeLang,
    togglePhoto,
    showPhoto,
    setShowPhoto,
    setPhotoPath,
    setAnonymousId,
    setUserId,
    setProfile,
    setEditorJson,
    editorJson,
    jdText,
    setResumeProfile
  } = useWorkspaceStore()

  const pathname = usePathname()

  const derivedInitialStatus = initialParseStatus ?? (experiences.length > 0 ? 'completed' : 'pending')
  const [parseStatus, setParseStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | 'not_found'
  >(derivedInitialStatus)

  // Simulated progress: 0–85 over ~30s, snaps to 100 on completion
  const [parseProgress, setParseProgress] = useState(derivedInitialStatus === 'completed' ? 100 : 0)
  const [showProgressBar, setShowProgressBar] = useState(derivedInitialStatus !== 'completed')

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf')
  const [showHistory, setShowHistory] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)

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
    // Populate parsed resume data if already available from server
    if (initialParsedData) {
      setResumeProfile(
        initialParsedData.personal_info ?? null,
        initialParsedData.education ?? [],
        initialParsedData.skills ?? []
      )
    }
    // Auto-enable photo if one was extracted
    if (initialPhotoPath) {
      setPhotoPath(initialPhotoPath)
      setShowPhoto(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshExperiences = useCallback(async () => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)
    const res = await fetch(`/api/resume/experiences?${params}`)
    if (!res.ok) return
    const { data } = await res.json()
    if (data) setExperiences(data)
  }, [anonymousId, userId, setExperiences])

  // Poll parse status + progressive experience loading
  useEffect(() => {
    if (parseStatus === 'completed') return

    let attempts = 0
    const MAX_ATTEMPTS = 60 // 2 min max

    // Animate progress bar: crawl to 85% over ~30s
    const progressInterval = setInterval(() => {
      setParseProgress(prev => {
        if (prev >= 85) return prev
        // faster at start, slower as it approaches 85
        const step = prev < 30 ? 3 : prev < 60 ? 1.5 : 0.5
        return Math.min(85, prev + step)
      })
    }, 500)

    const pollInterval = setInterval(async () => {
      attempts++
      try {
        const params = new URLSearchParams()
        if (userId) params.set('user_id', userId)
        else params.set('anonymous_id', anonymousId)

        const res = await fetch(`/api/resume/parse-status?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const { status } = data
        setParseStatus(status)

        // Progressive load: refresh experiences every 4s while parsing
        if ((status === 'processing' || status === 'pending') && attempts % 2 === 0) {
          await refreshExperiences()
        }

        if (status === 'completed') {
          clearInterval(pollInterval)
          clearInterval(progressInterval)
          setParseProgress(100)
          await refreshExperiences()

          // Load personal info, education, skills into store
          if (data.parsed_data) {
            const pd = data.parsed_data
            setResumeProfile(
              pd.personal_info ?? null,
              pd.education ?? [],
              pd.skills ?? []
            )
          }

          // Auto-enable photo toggle if a photo was extracted
          if (data.photo_extracted_path) {
            setPhotoPath(data.photo_extracted_path)
            setShowPhoto(true)
          }

          // Hide progress bar after brief success flash
          setTimeout(() => setShowProgressBar(false), 1200)
        } else if (status === 'failed' || attempts >= MAX_ATTEMPTS) {
          clearInterval(pollInterval)
          clearInterval(progressInterval)
          setParseProgress(100)
          // Keep bar visible to show error state
        }
      } catch { /* network error — keep polling */ }
    }, 2000)

    return () => {
      clearInterval(pollInterval)
      clearInterval(progressInterval)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // History button from toolbar
  useEffect(() => {
    const handleHistory = () => setShowHistory(v => !v)
    window.addEventListener('cf:history', handleHistory)
    return () => window.removeEventListener('cf:history', handleHistory)
  }, [])


  const handleRestoreVersion = (version: ResumeVersion) => {
    if (version.editor_json) setEditorJson(version.editor_json)
  }

  const handleExport = async (format: 'pdf' | 'docx' = 'pdf') => {
    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format,
      has_jd: jdText.length > 0,
      has_photo: showPhoto
    })
    if (profile?.payment_market === 'en_paid') {
      setExportFormat(format)
      setShowExportModal(true)
      return
    }
    setExportFormat(format)
    setShowExportModal(true)
  }

  const handlePhotoToggle = () => {
    togglePhoto()
    trackEvent('photo_toggled', {
      anonymous_id: anonymousId,
      state: !showPhoto ? 'on' : 'off'
    })
  }

  const langLabels: Record<string, string> = { zh: '中文', en: 'English', bilingual: '双语' }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      {/* Top nav bar */}
      <WorkspaceToolbar anonymousId={anonymousId} userId={userId} profile={profile} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="hidden md:flex flex-col flex-shrink-0 w-20 md:w-64 bg-slate-50 py-8 px-4 z-10">
          <div className="space-y-2 flex-1">
            {SIDEBAR_ITEMS.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href.split('?')[0] + '/')
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs uppercase tracking-widest font-bold font-headline',
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm translate-x-1'
                      : 'text-slate-400 hover:text-indigo-400'
                  )}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="hidden md:block">{item.key.charAt(0).toUpperCase() + item.key.slice(1)}</span>
                </Link>
              )
            })}
          </div>

          {(!profile || profile.payment_market === 'cn_free') && (
            <div className="mt-auto p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl hidden md:block">
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

        {/* Main content: left inputs + right resume */}
        <main className="flex flex-1 overflow-hidden flex-col md:flex-row bg-surface relative">

          {/* Left column: JD + achievements */}
          <div className="w-full md:w-[40%] flex flex-col h-full bg-surface-container-low border-r border-outline-variant/10">
            <JDPanel />
            <AchievementPanel />
          </div>

          {/* Right column: resume preview */}
          <div className="w-full md:w-[60%] h-full flex flex-col bg-surface-container-lowest">
            {/* Resume sub-toolbar */}
            <div className="w-full px-8 py-4 bg-white border-b border-outline-variant/10 flex items-center justify-between z-30 flex-shrink-0">
              <div className="flex items-center gap-6">
                {/* Language selector */}
                <div className="relative">
                  <button
                    onClick={() => setLangDropdownOpen(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                  >
                    {langLabels[resumeLang] ?? 'Language'} ▼
                  </button>
                  {langDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setLangDropdownOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-lg rounded-lg overflow-hidden w-32 z-20">
                        {(['zh', 'en', 'bilingual'] as const).map(lang => (
                          <button
                            key={lang}
                            onClick={() => { setResumeLang(lang); setLangDropdownOpen(false) }}
                            className={cn(
                              'w-full text-left px-4 py-2 text-xs hover:bg-indigo-50',
                              resumeLang === lang && 'text-indigo-600 font-bold'
                            )}
                          >
                            {langLabels[lang]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Photo toggle */}
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-lg">photo_camera</span>
                  <label className="relative inline-flex items-center cursor-pointer" onClick={handlePhotoToggle}>
                    <input readOnly type="checkbox" checked={showPhoto} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-checked:bg-indigo-600 rounded-full relative after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    <span className="ms-2 text-xs font-bold text-slate-600">Show Photo</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowHistory(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                >
                  <span className="material-symbols-outlined text-base">history</span>
                  Version History
                </button>
                <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-2 px-6 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                  Export ▼
                </button>
              </div>
            </div>

            {/* Resume content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-surface-container-lowest">
              <div className="max-w-3xl mx-auto">
                {/* Editor meta */}
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-saved</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors">
                      <span className="material-symbols-outlined text-sm">zoom_in</span>
                    </button>
                    <button className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors">
                      <span className="material-symbols-outlined text-sm">print</span>
                    </button>
                  </div>
                </div>

                {/* Resume paper */}
                <div className="bg-white shadow-[0_32px_64px_-16px_rgba(27,27,36,0.06)] rounded-sm border border-outline-variant/10">
                  <ResumePreview anonymousId={anonymousId} userId={userId} />
                </div>
              </div>
            </div>
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
        </main>
      </div>

      {/* Parse progress bar — bottom-right, only visible while parsing */}
      {showProgressBar && (
        <div className="fixed bottom-8 right-8 z-50 w-72 bg-on-surface text-surface px-5 py-4 rounded-2xl shadow-2xl">
          {parseStatus === 'failed' ? (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-lg flex-shrink-0">error_outline</span>
              <div className="flex-1">
                <p className="text-xs font-bold mb-1">解析失败</p>
                <Link
                  href="/upload"
                  className="text-[11px] text-indigo-300 hover:text-indigo-200 underline"
                >
                  返回重新上传
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {parseProgress < 100 && (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-300 animate-spin flex-shrink-0" />
                  )}
                  {parseProgress >= 100 && (
                    <span className="material-symbols-outlined text-emerald-400 text-base flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  <span className="text-xs font-bold text-surface/90">
                    {parseProgress < 100 ? 'AI 正在提炼成就...' : '提炼完成'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-indigo-300">{Math.round(parseProgress)}%</span>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${parseProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
