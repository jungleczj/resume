'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { JDPanel } from './JDPanel'
import { AchievementPanel } from './AchievementPanel'
import { ResumePreview } from './ResumePreview'
import { ExportModal } from './ExportModal'
import { VersionHistorySidebar } from './VersionHistorySidebar'
import { PIIBanner } from './PIIBanner'
import { Link } from '@/lib/i18n/navigation'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { WorkExperience, Profile, ResumeVersion, ResumePersonalInfo, ResumeEducation, ResumeSkillGroup, Certification, SpokenLanguage, Award, Publication } from '@/lib/types/domain'

interface WorkspaceClientProps {
  initialExperiences: WorkExperience[]
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
  uploadFilePath?: string | null
  uploadFileType?: string | null
  uploadId?: string
}

const SIDEBAR_ITEMS = [
  { key: 'workspace', icon: 'edit_note', href: '/workspace' },
  { key: 'library', icon: 'emoji_events', href: '/library' },
  { key: 'drafts', icon: 'description', href: '/library?tab=drafts' },
  { key: 'settings', icon: 'settings', href: '/settings' },
]

export function WorkspaceClient({
  initialExperiences,
  anonymousId,
  userId,
  profile,
  locale: _locale,
  initialParseStatus,
  initialParsedData,
  initialPhotoPath,
  uploadFilePath,
  uploadFileType,
  uploadId,
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
    setResumeProfile,
    setResumeSections,
    resumeEducation,
    resumeSkills,
    setUploadFile,
    resumePersonalInfo,
    experiences: storeExperiences,
    setIsGenerating,
    isGenerating,
    saveVersion,
    setTranslatedTexts,
    clearTranslatedTexts,
    applyTranslatedProfile,
    restoreVersion,
    splitRatio,
    setSplitRatio,
    verticalSplitRatio,
    setVerticalSplitRatio,
  } = useWorkspaceStore()

  const derivedInitialStatus = initialParseStatus ?? (initialExperiences.length > 0 ? 'completed' : 'pending')
  const [parseStatus, setParseStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | 'not_found'
  >(derivedInitialStatus)

  // Simulated progress: 0–85 over ~30s, snaps to 100 on completion
  const [parseProgress, setParseProgress] = useState(derivedInitialStatus === 'completed' ? 100 : 0)
  const [showProgressBar, setShowProgressBar] = useState(derivedInitialStatus !== 'completed')

  const t = useTranslations()
  const [draftRecoveryAvailable, setDraftRecoveryAvailable] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf')
  const [showHistory, setShowHistory] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [savedRecently, setSavedRecently] = useState(false)
  const layer3TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Resizable panel dividers ──────────────────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const [isDraggingH, setIsDraggingH] = useState(false)
  const [isDraggingV, setIsDraggingV] = useState(false)

  const onHDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingH(true)
    const onMove = (ev: MouseEvent) => {
      if (!mainRef.current) return
      const rect = mainRef.current.getBoundingClientRect()
      const ratio = Math.min(0.65, Math.max(0.25, (ev.clientX - rect.left) / rect.width))
      setSplitRatio(ratio)
    }
    const onUp = () => {
      setIsDraggingH(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setSplitRatio])

  const onVDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingV(true)
    const onMove = (ev: MouseEvent) => {
      if (!leftRef.current) return
      const rect = leftRef.current.getBoundingClientRect()
      const ratio = Math.min(0.75, Math.max(0.20, (ev.clientY - rect.top) / rect.height))
      setVerticalSplitRatio(ratio)
    }
    const onUp = () => {
      setIsDraggingV(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setVerticalSplitRatio])

  // Init store
  useEffect(() => {
    setAnonymousId(anonymousId)
    setUserId(userId)
    setProfile(profile)
    setExperiences(initialExperiences)
    if (profile) {
      setResumeLang(profile.resume_lang_preference)
    }

    // Photo toggle: restore from localStorage first, then fall back to market default
    const savedPhoto = localStorage.getItem(`cf_photo_${anonymousId}`)
    if (savedPhoto !== null) {
      setShowPhoto(savedPhoto === 'true')
    } else if (profile?.payment_market === 'cn_free') {
      setShowPhoto(true)
    }

    // Populate parsed resume data if already available from server
    if (initialParsedData) {
      const pd = initialParsedData as Record<string, unknown>
      setResumeProfile(
        (pd.personal_info as ResumePersonalInfo) ?? null,
        (pd.education as ResumeEducation[]) ?? [],
        (pd.skills as ResumeSkillGroup[]) ?? []
      )
      setResumeSections(
        (pd.certifications as Certification[]) ?? [],
        (pd.spoken_languages as SpokenLanguage[]) ?? [],
        (pd.awards as Award[]) ?? [],
        (pd.publications as Publication[]) ?? []
      )
    }

    // Auto-enable photo if one was extracted
    if (initialPhotoPath) {
      setPhotoPath(initialPhotoPath)
      setShowPhoto(true)
    }

    // Store original file info for preview
    if (uploadFilePath && uploadFileType) {
      setUploadFile(uploadFilePath, uploadFileType)
    }

    // Crash recovery: check for recent unsaved edits in localStorage
    if (initialParseStatus === 'completed') {
      try {
        const raw = localStorage.getItem(`cf_draft_${anonymousId}`)
        if (raw) {
          const draft = JSON.parse(raw) as { resumePersonalInfo?: unknown; savedAt?: number }
          const age = Date.now() - (draft.savedAt ?? 0)
          // Show recovery if draft is < 2 hours old and has content
          if (age < 2 * 60 * 60 * 1000 && draft.resumePersonalInfo) {
            setDraftRecoveryAvailable(true)
          }
        }
      } catch { /* ignore malformed draft */ }
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

          // Load personal info, education, skills + Fortune 500 sections into store
          if (data.parsed_data) {
            const pd = data.parsed_data as Record<string, unknown>
            setResumeProfile(
              (pd.personal_info as ResumePersonalInfo) ?? null,
              (pd.education as ResumeEducation[]) ?? [],
              (pd.skills as ResumeSkillGroup[]) ?? []
            )
            setResumeSections(
              (pd.certifications as Certification[]) ?? [],
              (pd.spoken_languages as SpokenLanguage[]) ?? [],
              (pd.awards as Award[]) ?? [],
              (pd.publications as Publication[]) ?? []
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

  // ── Layer 2: localStorage auto-save (debounced 500ms) ──────────────────────
  // Persists resumePersonalInfo + experiences to localStorage on any change.
  // Key: cf_draft_{anonymousId}
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!anonymousId) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const draft = { resumePersonalInfo, experiences: storeExperiences, savedAt: Date.now() }
        localStorage.setItem(`cf_draft_${anonymousId}`, JSON.stringify(draft))
      } catch {
        // Quota exceeded or private browsing — ignore
      }
    }, 500)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [resumePersonalInfo, storeExperiences, anonymousId])

  // ── Layer 3: Supabase auto-save (debounced 3s) ────────────────────────────
  // Only fires after parse is fully complete — saves empty snapshots during
  // the parse phase are useless and pollute version history.
  useEffect(() => {
    if (!anonymousId && !userId) return
    // Do not auto-save while resume is still being parsed
    if (parseStatus !== 'completed') return
    // Do not save if there's no real content yet
    const hasContent = !!resumePersonalInfo || storeExperiences.some(e =>
      (e.achievements ?? []).some(a => a.status === 'confirmed')
    )
    if (!hasContent) return

    if (layer3TimerRef.current) clearTimeout(layer3TimerRef.current)
    layer3TimerRef.current = setTimeout(() => {
      saveVersion()
    }, 3000)
    return () => {
      if (layer3TimerRef.current) clearTimeout(layer3TimerRef.current)
    }
  }, [resumePersonalInfo, storeExperiences, parseStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Language-change triggers regeneration when confirmed achievements exist ─
  // Track the previous lang so we only fire on actual changes (not initial mount).
  const prevResumeLangRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevResumeLangRef.current
    prevResumeLangRef.current = resumeLang

    // Skip on initial mount
    if (prev === null) return
    // Skip if lang didn't actually change
    if (prev === resumeLang) return
    // Only regenerate if there's at least one confirmed achievement
    const hasConfirmed = storeExperiences.some((exp) =>
      (exp.achievements ?? []).some((a) => a.status === 'confirmed')
    )
    if (!hasConfirmed) return
    // Don't queue a second generation if one is already in flight
    if (isGenerating) return

    const triggerRegen = async () => {
      // Switching back to Chinese — clear translations and re-confirm from DB
      if (resumeLang === 'zh') {
        clearTranslatedTexts()
        setIsGenerating(false)
        return
      }

      setIsGenerating(true)
      try {
        const res = await fetch('/api/resume/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd_text: jdText,
            anonymous_id: anonymousId,
            user_id: userId,
            resume_lang: resumeLang,
            // Include profile data so the API can translate it too
            personal_info: resumePersonalInfo,
            education: resumeEducation,
            skills: resumeSkills,
          }),
        })
        if (!res.ok) return
        const { data } = await res.json()
        if (data?.editor_json) setEditorJson(data.editor_json)
        // Apply translated achievement texts to the preview
        if (data?.translated_achievements?.length) {
          const map: Record<string, string> = {}
          for (const item of data.translated_achievements as { id: string; text: string }[]) {
            map[item.id] = item.text
          }
          setTranslatedTexts(map)
        }
        // Apply translated profile (personal info, education, skills)
        if (data?.translated_personal_info || data?.translated_education?.length || data?.translated_skills?.length) {
          applyTranslatedProfile(
            (data.translated_personal_info as ResumePersonalInfo) ?? null,
            (data.translated_education as ResumeEducation[]) ?? [],
            (data.translated_skills as ResumeSkillGroup[]) ?? []
          )
        }
        trackEvent('resume_generated', {
          anonymous_id: anonymousId,
          has_jd: jdText.length > 0,
          resume_lang: resumeLang,
          trigger: 'lang_change',
        })
      } catch {
        // Network error — silently skip
      } finally {
        setIsGenerating(false)
      }
    }

    triggerRegen()
  }, [resumeLang]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestoreVersion = (version: ResumeVersion) => {
    if (version.editor_json) {
      restoreVersion(version.editor_json, version.resume_lang, version.show_photo)
    }
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
    const nextState = !showPhoto
    togglePhoto()
    try { localStorage.setItem(`cf_photo_${anonymousId}`, String(nextState)) } catch { /* quota */ }
    trackEvent('photo_toggled', {
      anonymous_id: anonymousId,
      state: nextState ? 'on' : 'off'
    })
  }

  const handleDraftRestore = () => {
    try {
      const raw = localStorage.getItem(`cf_draft_${anonymousId}`)
      if (!raw) return
      const draft = JSON.parse(raw) as { resumePersonalInfo?: ResumePersonalInfo | null; experiences?: WorkExperience[] }
      if (draft.resumePersonalInfo) {
        setResumeProfile(draft.resumePersonalInfo, resumeEducation, resumeSkills)
      }
      if (draft.experiences?.length) {
        setExperiences(draft.experiences)
      }
    } catch { /* ignore */ }
    setDraftRecoveryAvailable(false)
  }

  const handleManualSave = async () => {
    if (savedRecently) return
    setSavedRecently(true)
    await saveVersion(`Manual save ${new Date().toLocaleTimeString()}`)
    setTimeout(() => setSavedRecently(false), 2000)
  }

  const langLabels: Record<string, string> = { zh: '中文', en: 'English', bilingual: '双语' }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      {/* Top nav bar */}
      <WorkspaceToolbar anonymousId={anonymousId} userId={userId} profile={profile} />

      {/* PII detection notice — only shown when resume contains sensitive data */}
      <PIIBanner uploadId={uploadId} anonymousId={anonymousId} userId={userId} />

      {/* Crash recovery banner */}
      {draftRecoveryAvailable && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs z-20 flex-shrink-0">
          <span className="material-symbols-outlined text-amber-500 text-base flex-shrink-0">restore_page</span>
          <span className="text-amber-800 font-medium flex-1">{t('workspace.draft_recovery.message')}</span>
          <button
            onClick={handleDraftRestore}
            className="px-3 py-1 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors"
          >
            {t('workspace.draft_recovery.restore')}
          </button>
          <button
            onClick={() => {
              setDraftRecoveryAvailable(false)
              try { localStorage.removeItem(`cf_draft_${anonymousId}`) } catch { /* ignore */ }
            }}
            className="px-3 py-1 text-amber-700 hover:bg-amber-100 rounded-lg font-bold transition-colors"
          >
            {t('workspace.draft_recovery.dismiss')}
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content: left inputs + right resume */}
        <main
          ref={mainRef}
          className={cn(
            'flex flex-1 overflow-hidden flex-row bg-surface relative',
            (isDraggingH || isDraggingV) && 'select-none'
          )}
        >
          {/* Left column: JD + achievements */}
          <div
            ref={leftRef}
            style={{ width: `${splitRatio * 100}%` }}
            className="flex flex-col h-full bg-surface-container-low flex-shrink-0"
          >
            {/* JD panel (resizable height) */}
            <div style={{ height: `${verticalSplitRatio * 100}%` }} className="flex-shrink-0 min-h-0 overflow-hidden">
              <JDPanel />
            </div>

            {/* Vertical divider (JD ↔ Achievement) */}
            <div
              onMouseDown={onVDividerMouseDown}
              className={cn(
                'h-1.5 flex-shrink-0 cursor-row-resize group relative flex items-center justify-center transition-colors',
                isDraggingV ? 'bg-primary/30' : 'bg-outline-variant/10 hover:bg-primary/20'
              )}
            >
              <div className="w-8 h-[3px] rounded-full bg-slate-300 group-hover:bg-primary/50 transition-colors" />
            </div>

            {/* Achievement panel (takes remaining height) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AchievementPanel />
            </div>
          </div>

          {/* Horizontal divider (left ↔ right) */}
          <div
            onMouseDown={onHDividerMouseDown}
            className={cn(
              'w-1.5 flex-shrink-0 cursor-col-resize group relative flex flex-col items-center justify-center transition-colors h-full',
              isDraggingH ? 'bg-primary/30' : 'bg-outline-variant/10 hover:bg-primary/20'
            )}
          >
            <div className="h-8 w-[3px] rounded-full bg-slate-300 group-hover:bg-primary/50 transition-colors" />
          </div>

          {/* Right column: resume preview */}
          <div className="flex-1 h-full flex flex-col bg-surface-container-lowest overflow-hidden">

            {/* Resume sub-toolbar */}
            <div className="w-full px-8 py-4 bg-white border-b border-outline-variant/10 flex items-center justify-between z-30 flex-shrink-0">
              <div className="flex items-center gap-6">
                {/* Language selector — EN market: fixed label; CN market: dropdown */}
                {profile?.payment_market === 'en_paid' ? (
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg cursor-default select-none">
                    English
                  </span>
                ) : (
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
                )}

                {/* Photo toggle */}
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-lg">photo_camera</span>
                  <button 
                    onClick={handlePhotoToggle}
                    className="relative inline-flex items-center cursor-pointer bg-transparent border-none p-0"
                  >
                    <div 
                      className={`w-9 h-5 rounded-full relative transition-all ${
                        showPhoto ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <div 
                        className={`absolute top-[2px] w-4 h-4 bg-white border rounded-full transition-all ${
                          showPhoto ? 'left-[20px]' : 'left-[2px]'
                        }`} 
                      />
                    </div>
                    <span className="ms-2 text-xs font-bold text-slate-600">{t('workspace.toolbar.show_photo')}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Save button */}
                <button
                  onClick={handleManualSave}
                  disabled={savedRecently}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border',
                    savedRecently
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default'
                      : 'text-slate-600 hover:bg-slate-50 border-slate-200'
                  )}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: savedRecently ? "'FILL' 1" : "'FILL' 0" }}>
                    {savedRecently ? 'check_circle' : 'save'}
                  </span>
                  {savedRecently ? 'Saved' : 'Save'}
                </button>
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

            {/* Template resume preview — editable, copy-protected */}
            <div className="flex-1 overflow-auto relative">
              <ResumePreview />
            </div>
          </div>
        </main>

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

      {/* Parse progress bar */}
      {showProgressBar && (
        <div className="fixed bottom-8 right-8 z-50 w-72 bg-on-surface text-surface px-5 py-4 rounded-2xl shadow-2xl">
          {parseStatus === 'failed' ? (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-lg flex-shrink-0">error_outline</span>
              <div className="flex-1">
                <p className="text-xs font-bold mb-1">解析失败</p>
                <Link href="/upload" className="text-[11px] text-indigo-300 hover:text-indigo-200 underline">
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
