'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X, Search, Clock, RotateCcw, Eye, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
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

// ── Typed editor_json structure ───────────────────────────────────────────────
interface AchievementNode {
  type: 'achievement'
  attrs?: { id?: string; tier?: number }
  content?: Array<{ type: string; text?: string }>
}
interface ExperienceNode {
  type: 'experience'
  attrs?: { company?: string; job_title?: string; original_tenure?: string; start_year?: number; end_year?: number; is_current?: boolean }
  content?: AchievementNode[]
}
interface EditorDoc {
  type: 'doc'
  content?: ExperienceNode[]
  meta?: { lang?: string; generated_at?: string }
}

function parseEditorJson(raw: object): EditorDoc | null {
  try {
    const doc = raw as EditorDoc
    if (doc.type === 'doc') return doc
    return null
  } catch {
    return null
  }
}

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

function tierColor(tier?: number): string {
  if (tier === 1) return 'text-emerald-600'
  if (tier === 2) return 'text-amber-500'
  return 'text-rose-500'
}

function tierDot(tier?: number): string {
  if (tier === 1) return 'bg-emerald-500'
  if (tier === 2) return 'bg-amber-400'
  return 'bg-rose-400'
}

// ── Version summary line ─────────────────────────────────────────────────────

type SummaryT = (key: string, params?: Record<string, string | number>) => string

function buildSummary(version: ResumeVersion, t: SummaryT, langLabels: Record<string, string>): string {
  const doc = parseEditorJson(version.editor_json)
  const exps = doc?.content ?? []
  const expCount = exps.length
  const achCount = exps.reduce((n, e) => n + (e.content?.length ?? 0), 0)

  const lang = version.resume_lang ?? doc?.meta?.lang
  const langLabel = lang ? (langLabels[lang] ?? lang) : null

  const parts: string[] = []
  if (expCount > 0) parts.push(t('workspace.version_history.positions', { count: expCount }))
  if (achCount > 0) parts.push(t('workspace.version_history.achievements_count', { count: achCount }))
  if (langLabel) parts.push(langLabel)
  if (version.snapshot_jd) parts.push(t('workspace.version_history.has_jd'))
  if (version.show_photo) parts.push(t('workspace.version_history.has_photo'))

  return parts.join(' · ')
}

// ── Version preview modal ────────────────────────────────────────────────────

function VersionPreviewModal({
  version,
  onClose,
  onRestore
}: {
  version: ResumeVersion
  onClose: () => void
  onRestore: () => void
}) {
  const t = useTranslations()
  const langLabels = {
    zh: t('workspace.resume_lang.zh'),
    en: t('workspace.resume_lang.en'),
    bilingual: t('workspace.resume_lang.bilingual'),
  }
  const doc = parseEditorJson(version.editor_json)
  const exps = doc?.content ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[85vh] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {version.snapshot_label || formatTime(version.created_at)}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatTime(version.created_at)} · {buildSummary(version, t, langLabels)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {exps.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">{t('workspace.version_history.no_data')}</p>
          ) : (
            exps.map((exp, ei) => {
              const tenure = exp.attrs?.original_tenure
                ?? (exp.attrs?.is_current
                  ? `${exp.attrs?.start_year ?? ''} — ${t('workspace.version_history.present')}`
                  : `${exp.attrs?.start_year ?? ''} — ${exp.attrs?.end_year ?? ''}`)

              return (
                <div key={ei}>
                  {/* Experience header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{exp.attrs?.company}</p>
                      <p className="text-xs text-gray-500">{exp.attrs?.job_title}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{tenure}</span>
                  </div>

                  {/* Achievement bullets */}
                  <ul className="space-y-1.5 pl-1">
                    {(exp.content ?? []).map((ach, ai) => {
                      const text = ach.content?.find(c => c.type === 'text')?.text ?? ''
                      return (
                        <li key={ai} className="flex items-start gap-2 text-xs text-gray-700">
                          <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', tierDot(ach.attrs?.tier))} />
                          <span className="leading-relaxed">{text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}

          {version.snapshot_jd && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
              <p className="text-xs font-medium text-indigo-700 mb-1">{t('workspace.version_history.jd_excerpt')}</p>
              <p className="text-xs text-indigo-600 line-clamp-3">{version.snapshot_jd}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {t('workspace.version_history.close')}
          </button>
          <button
            onClick={() => { onRestore(); onClose() }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {t('workspace.version_history.restore')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main sidebar ─────────────────────────────────────────────────────────────

export function VersionHistorySidebar({
  anonymousId,
  userId,
  open,
  onClose,
  onRestore
}: VersionHistorySidebarProps) {
  const t = useTranslations()
  const langLabels = {
    zh: t('workspace.resume_lang.zh'),
    en: t('workspace.resume_lang.en'),
    bilingual: t('workspace.resume_lang.bilingual'),
  }
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [viewingVersion, setViewingVersion] = useState<ResumeVersion | null>(null)

  const handleRename = useCallback(async (id: string, label: string) => {
    // Optimistic update
    setVersions(vs => vs.map(v => v.id === id ? { ...v, snapshot_label: label } : v))
    try {
      await fetch(`/api/resume/versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_label: label }),
      })
      void trackEvent('version_renamed', { anonymous_id: anonymousId, user_id: userId ?? undefined })
    } catch {
      // Optimistic — ignore network errors
    }
  }, [anonymousId, userId])

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
    void trackEvent('version_restored', {
      anonymous_id: anonymousId,
      user_id: userId ?? undefined,
      snapshot_label: version.snapshot_label ?? undefined,
    })
    setRestoring(null)
    onClose()
  }

  return (
    <>
      {/* Version preview modal */}
      {viewingVersion && (
        <VersionPreviewModal
          version={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRestore={() => handleRestore(viewingVersion)}
        />
      )}

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
                        onView={() => setViewingVersion(v)}
                        onRestoreClick={() => setConfirmId(v.id)}
                        onConfirmRestore={() => handleRestore(v)}
                        onCancelRestore={() => setConfirmId(null)}
                        onRename={handleRename}
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
  onRename,
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
  onRename: (id: string, label: string) => void
  t: ReturnType<typeof useTranslations>
}) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(version.snapshot_label ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const commitRename = () => {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== version.snapshot_label) {
      onRename(version.id, trimmed)
    }
    setEditingLabel(false)
  }

  const langLabels: Record<string, string> = {
    zh: t('workspace.resume_lang.zh'),
    en: t('workspace.resume_lang.en'),
    bilingual: t('workspace.resume_lang.bilingual'),
  }
  const summary = buildSummary(version, t, langLabels)

  // Tier breakdown for visual indicator
  const doc = parseEditorJson(version.editor_json)
  const allAchs = (doc?.content ?? []).flatMap(e => e.content ?? [])
  const t1 = allAchs.filter(a => a.attrs?.tier === 1).length
  const t2 = allAchs.filter(a => a.attrs?.tier === 2).length
  const t3 = allAchs.filter(a => (a.attrs?.tier ?? 3) === 3).length

  return (
    <div className={cn(
      'p-3 rounded-xl border transition-colors',
      isCurrent ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'
    )}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {editingLabel ? (
              <input
                ref={inputRef}
                autoFocus
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setLabelDraft(version.snapshot_label ?? ''); setEditingLabel(false) }
                }}
                className="text-xs font-semibold text-gray-800 border-b border-indigo-400 bg-transparent outline-none min-w-0 flex-1 max-w-[160px]"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-xs font-semibold text-gray-800 truncate cursor-text"
                onDoubleClick={() => { setLabelDraft(version.snapshot_label ?? formatTime(version.created_at)); setEditingLabel(true) }}
                title={t('workspace.version_history.rename_hint')}
              >
                {version.snapshot_label || formatTime(version.created_at)}
              </span>
            )}
            {isCurrent && (
              <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                {t('version_history.current')}
              </span>
            )}
            {version.is_auto_save === false && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {t('workspace.version_history.manual_save')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{formatTime(version.created_at)}</p>
        </div>
      </div>

      {/* Summary line */}
      {summary && (
        <p className="text-[11px] text-gray-500 mb-1.5 leading-relaxed">{summary}</p>
      )}

      {/* Tier dots */}
      {allAchs.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          {t1 > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {t1}
            </span>
          )}
          {t2 > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {t2}
            </span>
          )}
          {t3 > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-rose-500">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
              {t3}
            </span>
          )}
        </div>
      )}

      {/* JD snippet */}
      {version.snapshot_jd && (
        <p className="text-[10px] text-indigo-500 mb-2 truncate">
          JD: {version.snapshot_jd.slice(0, 50)}
        </p>
      )}

      {isConfirming ? (
        <div className="mt-2">
          <p className="text-xs text-amber-600 mb-2">{t('version_history.restore_confirm')}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmRestore}
              disabled={isRestoring}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
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
        <div className="flex items-center gap-2 mt-1">
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
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t('version_history.restore')}
            </button>
          )}
          <button
            onClick={onView}
            className="ml-auto text-gray-300 hover:text-gray-500 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
