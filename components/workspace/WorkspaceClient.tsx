'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { WorkspaceToolbar } from './WorkspaceToolbar'
import { JDPanel } from './JDPanel'
import { AchievementPanel } from './AchievementPanel'
import { ResumePreview } from './ResumePreview'
import { ExportModal } from './ExportModal'
import { Loader2 } from 'lucide-react'
import type { WorkExperience, Profile } from '@/lib/types/domain'

interface WorkspaceClientProps {
  experiences: WorkExperience[]
  anonymousId: string
  userId: string | null
  profile: Profile | null
  locale: string
}

export function WorkspaceClient({
  experiences,
  anonymousId,
  userId,
  profile,
  locale
}: WorkspaceClientProps) {
  const {
    setExperiences,
    setResumeLang,
    togglePhoto,
    showPhoto,
    setAnonymousId,
    setUserId,
    setProfile
  } = useWorkspaceStore()

  const [parseStatus, setParseStatus] = useState<
    'pending' | 'processing' | 'completed' | 'failed' | 'not_found'
  >(experiences.length > 0 ? 'completed' : 'pending')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf')

  // Set store defaults
  useEffect(() => {
    setAnonymousId(anonymousId)
    setUserId(userId)
    setProfile(profile)
    setExperiences(experiences)
    if (profile) {
      setResumeLang(profile.resume_lang_preference)
      if (profile.payment_market === 'cn_free' && !showPhoto) {
        togglePhoto()
      }
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

  // Refresh experiences from server when parse completes
  const refreshExperiences = useCallback(async () => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', userId)
    else params.set('anonymous_id', anonymousId)

    const res = await fetch(`/api/resume/experiences?${params}`)
    if (!res.ok) return

    const { data } = await res.json()
    if (data) setExperiences(data)
  }, [anonymousId, userId, setExperiences])

  // Start polling if not yet completed on mount
  useEffect(() => {
    if (parseStatus === 'completed') return

    let attempts = 0
    const MAX_ATTEMPTS = 30 // 30 × 2s = 60s max

    const interval = setInterval(async () => {
      attempts++
      const status = await pollParseStatus()

      if (status === 'completed') {
        clearInterval(interval)
        await refreshExperiences()
      } else if (status === 'failed' || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for paywall/export events from WorkspaceToolbar
  useEffect(() => {
    const handlePaywall = (e: Event) => {
      const format = (e as CustomEvent).detail?.format ?? 'pdf'
      setExportFormat(format)
      setShowExportModal(true)
    }
    const handleExport = (e: Event) => {
      const format = (e as CustomEvent).detail?.format ?? 'pdf'
      setExportFormat(format)
      setShowExportModal(true)
    }

    window.addEventListener('cf:paywall', handlePaywall)
    window.addEventListener('cf:export', handleExport)
    return () => {
      window.removeEventListener('cf:paywall', handlePaywall)
      window.removeEventListener('cf:export', handleExport)
    }
  }, [])

  const isParsing = parseStatus === 'pending' || parseStatus === 'processing'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <WorkspaceToolbar
        anonymousId={anonymousId}
        userId={userId}
        profile={profile}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Parsing overlay */}
        {isParsing && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800">AI 正在提炼成就...</p>
              <p className="text-xs text-gray-500 mt-1">通常需要 10–30 秒</p>
            </div>
          </div>
        )}

        {parseStatus === 'failed' && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-red-600">解析失败</p>
              <p className="text-xs text-gray-500 mt-1">请返回首页重新上传</p>
            </div>
          </div>
        )}

        {/* Left panel: JD + Achievement bank */}
        <div className="w-[380px] min-w-[320px] flex flex-col border-r border-gray-200 bg-white">
          <JDPanel />
          <div className="h-px bg-gray-200 cursor-row-resize flex items-center justify-center hover:bg-brand transition-colors">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>
          <AchievementPanel />
        </div>

        {/* Right panel: Resume preview */}
        <div className="flex-1 overflow-auto">
          <ResumePreview anonymousId={anonymousId} userId={userId} />
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
