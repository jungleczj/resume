'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { X, Search, Clock, RotateCcw, Eye, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumeVersion } from '@/lib/types/domain'

interface VersionHistorySidebarProps {
  anonymousId: string
  userId: string | null
  currentJson: object
  open: boolean
  onClose: () => void
  onRestore: (version: ResumeVersion) => void
}

type DateGroup = 'today' | 'yesterday' | 'this_week' | 'earlier'

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return 'today'
  if (diffDays < 2) return 'yesterday'
  if (diffDays < 7) return 'this_week'
  return 'earlier'
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function VersionHistorySidebar({
  anonymousId,
  userId,
  open,
  onClose,
  onRestore
}: VersionHistorySidebarProps) {
  const t = useTranslations()
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userId) params.set('user_id', userId)
      else params.set('anonymous_id', anonymousId)

      const res = await fetch(`/api/resume/versions?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setVersions(data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [anonymousId, userId])

  useEffect(() => {
    if (open) fetchVersions()
  }, [open, fetchVersions])

  const filtered = versions.filter(v =>
    !search || v.snapshot_label?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by date
  const groups: Partial<Record<DateGroup, ResumeVersion[]>> = {}
  const groupOrder: DateGroup[] = ['today', 'yesterday', 'this_week', 'earlier']

  for (const v of filtered) {
    const g = getDateGroup(v.created_at)
    if (!groups[g]) groups[g] = []
    groups[g]!.push(v)
  }

  const handleRestore = async (version: ResumeVersion) => {
    setRestoring(version.id)
    setConfirmId(null)
    onRestore(version)
    setRestoring(null)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/10"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed right-0 top-14 bottom-0 z-40 w-[400px] bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.1)] flex flex-col transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              {t('version_history.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('version_history.search_placeholder')}
              className="flex-1 text-xs bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-12">
              {t('version_history.empty')}
            </p>
          ) : (
            groupOrder.map(group => {
              const items = groups[group]
              if (!items?.length) return null

              return (
                <div key={group} className="mb-4">
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <span className="text-xs font-medium text-gray-400">
                      📅 {t(`version_history.groups.${group}`)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-2">
                    {items.map((v, i) => (
                      <VersionCard
                        key={v.id}
                        version={v}
                        isCurrent={i === 0 && group === 'today'}
                        isConfirming={confirmId === v.id}
                        isRestoring={restoring === v.id}
                        onView={() => {/* Preview mode handled separately */}}
                        onRestoreClick={() => setConfirmId(v.id)}
                        onConfirmRestore={() => handleRestore(v)}
                        onCancelRestore={() => setConfirmId(null)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

function VersionCard({
  version,
  isCurrent,
  isConfirming,
  isRestoring,
  onView,
  onRestoreClick,
  onConfirmRestore,
  onCancelRestore,
  t
}: {
  version: ResumeVersion
  isCurrent: boolean
  isConfirming: boolean
  isRestoring: boolean
  onView: () => void
  onRestoreClick: () => void
  onConfirmRestore: () => void
  onCancelRestore: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className={cn(
      'p-3 rounded-xl border transition-colors',
      isCurrent ? 'border-brand bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
    )}>
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-800">
              {version.snapshot_label || formatTime(version.created_at)}
            </span>
            {isCurrent && (
              <span className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full">
                {t('version_history.current')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{formatTime(version.created_at)}</p>
          {version.snapshot_jd && (
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">
              · {version.snapshot_jd.slice(0, 40)}...
            </p>
          )}
        </div>
      </div>

      {isConfirming ? (
        <div className="mt-2">
          <p className="text-xs text-amber-600 mb-2">{t('version_history.restore_confirm')}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmRestore}
              disabled={isRestoring}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {isRestoring && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('version_history.restore_yes')}
            </button>
            <button
              onClick={onCancelRestore}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('version_history.restore_cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onView}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-3 h-3" />
            {t('version_history.view')}
          </button>
          {!isCurrent && (
            <button
              onClick={onRestoreClick}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-brand border border-brand rounded-lg hover:bg-brand-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t('version_history.restore')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
