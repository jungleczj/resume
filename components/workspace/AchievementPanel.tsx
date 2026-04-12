'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import type { Achievement, AchievementTier, WorkExperience } from '@/lib/types/domain'

// Tier colored dot config: 🟢 tier1, 🟡 tier2, 🔴 tier3
const TIER_DOT: Record<AchievementTier, string> = {
  1: 'bg-emerald-500',
  2: 'bg-amber-400',
  3: 'bg-rose-400',
}

// Tier label for the tag badge
const TIER_LABEL: Record<AchievementTier, string> = {
  1: 'Impact',
  2: 'Growth',
  3: 'Experience',
}

export function AchievementPanel() {
  const t = useTranslations()
  const {
    experiences,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    anonymousId,
    confirmAchievement,
    ignoreAchievement,
    updateAchievementInPanel,
    activeAchievementId,
    setActiveAchievementId,
  } = useWorkspaceStore()

  const listRef = useRef<HTMLDivElement>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)

  // When activeAchievementId changes (from resume click), ensure library tab is visible then scroll
  useEffect(() => {
    if (!activeAchievementId || !listRef.current) return
    // Confirmed achievements live in the library tab — auto-switch if needed
    const isConfirmed = experiences
      .flatMap((e) => e.achievements ?? [])
      .find((a) => a.id === activeAchievementId)?.status === 'confirmed'
    if (isConfirmed && activeTab !== 'library') {
      setActiveTab('library')
      // DOM update happens next tick — defer the scroll
      requestAnimationFrame(() => {
        const card = listRef.current?.querySelector(`[data-ach-id="${activeAchievementId}"]`) as HTMLElement | null
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    const card = listRef.current.querySelector(`[data-ach-id="${activeAchievementId}"]`) as HTMLElement | null
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeAchievementId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Count drafts and ignored for badges
  const draftCount = experiences
    .flatMap((exp) => exp.achievements ?? [])
    .filter((a) => a.status === 'draft').length

  const ignoredCount = experiences
    .flatMap((exp) => exp.achievements ?? [])
    .filter((a) => a.status === 'ignored').length

  // Build per-experience groups, filtering by tab and search
  const groups: Array<{ exp: WorkExperience; achievements: Achievement[] }> = experiences
    .map((exp) => {
      const filtered = (exp.achievements ?? [])
        .filter((a) => {
          if (showIgnored) return a.status === 'ignored'
          if (activeTab === 'drafts') return a.status === 'draft'
          if (activeTab === 'library') return a.status === 'confirmed'
          return true
        })
        .filter((a) =>
          searchQuery ? a.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
        )
      return { exp, achievements: filtered }
    })
    .filter((g) => g.achievements.length > 0)

  const totalFiltered = groups.reduce((sum, g) => sum + g.achievements.length, 0)

  // All visible draft IDs for bulk operations
  const allDraftIds = activeTab === 'drafts'
    ? groups.flatMap(g => g.achievements.map(a => a.id))
    : []

  const handleBulkConfirm = useCallback(async () => {
    if (!allDraftIds.length || isBulkProcessing) return
    setIsBulkProcessing(true)
    try {
      await Promise.all(allDraftIds.map(id => confirmAchievement(id)))
      trackEvent('bulk_confirm', { anonymous_id: anonymousId, count: allDraftIds.length })
    } finally {
      setIsBulkProcessing(false)
    }
  }, [allDraftIds, confirmAchievement, anonymousId, isBulkProcessing])

  const handleBulkIgnore = useCallback(async () => {
    if (!allDraftIds.length || isBulkProcessing) return
    setIsBulkProcessing(true)
    try {
      await Promise.all(allDraftIds.map(id => ignoreAchievement(id)))
      trackEvent('bulk_ignore', { anonymous_id: anonymousId, count: allDraftIds.length })
    } finally {
      setIsBulkProcessing(false)
    }
  }, [allDraftIds, ignoreAchievement, anonymousId, isBulkProcessing])

  // Drag tooltip state: text + mouse position
  const [dragTooltip, setDragTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const handleDragStart = (e: React.DragEvent, achievement: Achievement) => {
    e.dataTransfer.setData('application/json', JSON.stringify(achievement))
    e.dataTransfer.effectAllowed = 'copy'
    setDragTooltip({ text: achievement.text, x: e.clientX, y: e.clientY })
    trackEvent('achievement_dragged', {
      anonymous_id: anonymousId,
      action: 'drag_start',
      from_tab: activeTab,
      tier: achievement.tier,
    })
  }

  const handleDragEnd = () => setDragTooltip(null)

  return (
    <section
      className="flex-1 min-h-0 flex flex-col bg-surface-container-high/30 rounded-t-[2.5rem] p-6 shadow-inner overflow-hidden"
      onDragOver={dragTooltip ? (e) => setDragTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
    >
      {/* Drag preview tooltip — follows mouse while dragging */}
      {dragTooltip && (
        <div
          className="fixed z-[9999] max-w-[280px] px-3 py-2 bg-gray-900/95 text-white text-[11px] leading-snug rounded-lg shadow-2xl pointer-events-none select-none"
          style={{ left: dragTooltip.x + 12, top: dragTooltip.y - 8 }}
        >
          {dragTooltip.text}
        </div>
      )}
      {/* Tabs */}
      <div className="flex items-center gap-6 mb-6">
        {(['library', 'drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'font-headline text-sm font-bold pb-2 relative transition-colors flex items-center gap-1.5',
              activeTab === tab
                ? 'text-primary font-extrabold after:content-[\'\'] after:absolute after:bottom-0 after:left-0 after:w-full after:h-1 after:bg-primary after:rounded-full'
                : 'text-slate-400 hover:text-on-surface'
            )}
          >
            {t(`workspace.achievement_panel.tabs.${tab}`)}
            {tab === 'drafts' && draftCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-extrabold bg-rose-500 text-white rounded-full leading-none">
                {draftCount > 99 ? '99+' : draftCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('workspace.achievement_panel.search_placeholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-full text-xs border-none focus:ring-2 focus:ring-primary/20 shadow-sm focus:outline-none"
        />
      </div>

      {/* Bulk actions bar — only in drafts tab when there are items */}
      {activeTab === 'drafts' && allDraftIds.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] text-slate-400 font-medium">
            {allDraftIds.length} {allDraftIds.length === 1 ? 'draft' : 'drafts'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkConfirm}
              disabled={isBulkProcessing}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 0" }}>check_circle</span>
              {t('workspace.achievement_panel.bulk_confirm')}
            </button>
            <button
              onClick={handleBulkIgnore}
              disabled={isBulkProcessing}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-rose-500 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 0" }}>cancel</span>
              {t('workspace.achievement_panel.bulk_ignore')}
            </button>
          </div>
        </div>
      )}

      {/* List — grouped by work experience */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-5" style={{ scrollbarWidth: 'thin' }}>
        {totalFiltered === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            {t('workspace.achievement_panel.empty_state')}
          </div>
        ) : (
          groups.map(({ exp, achievements }) => (
            <div key={exp.id}>
              {/* Company group header */}
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span className="material-symbols-outlined text-slate-300 text-sm flex-shrink-0">
                  business
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {exp.company}
                </span>
                <span className="text-[10px] text-slate-300 flex-shrink-0">
                  · {exp.job_title}
                </span>
              </div>

              {/* Achievement cards */}
              <div className="space-y-3 pl-1">
                {achievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    isDraftsTab={activeTab === 'drafts' && !showIgnored}
                    isIgnoredTab={showIgnored}
                    isActive={activeAchievementId === achievement.id}
                    onActivate={(id) => {
                      const nextActive = activeAchievementId === id ? null : id
                      setActiveAchievementId(nextActive)
                      if (nextActive) {
                        trackEvent('achievement_highlighted', {
                          anonymous_id: anonymousId,
                          achievement_id: id,
                          from: 'panel',
                        })
                      }
                    }}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onConfirm={confirmAchievement}
                    onIgnore={ignoreAchievement}
                    onSaveText={updateAchievementInPanel}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Ignored achievements toggle — shows at bottom when there are ignored items */}
        {!showIgnored && ignoredCount > 0 && activeTab !== 'drafts' && (
          <div className="pt-3 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setShowIgnored(true)}
              className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">visibility_off</span>
              {ignoredCount} ignored · Show
            </button>
          </div>
        )}
        {showIgnored && (
          <div className="pt-3 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setShowIgnored(false)}
              className="text-[10px] text-indigo-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">visibility</span>
              Hide ignored
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function AchievementCard({
  achievement,
  isDraftsTab,
  isIgnoredTab,
  isActive,
  onActivate,
  onDragStart,
  onDragEnd,
  onConfirm,
  onIgnore,
  onSaveText,
}: {
  achievement: Achievement
  isDraftsTab: boolean
  isIgnoredTab: boolean
  isActive: boolean
  onActivate: (id: string) => void
  onDragStart: (e: React.DragEvent, a: Achievement) => void
  onDragEnd: () => void
  onConfirm: (id: string) => Promise<void>
  onIgnore: (id: string) => Promise<void>
  onSaveText: (id: string, text: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(achievement.text)

  const tier = (achievement.tier as AchievementTier) ?? 3
  const dotClass = TIER_DOT[tier]
  const label = TIER_LABEL[tier]

  const handleSaveEdit = async () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== achievement.text) {
      await onSaveText(achievement.id, trimmed)
    }
    setIsEditing(false)
  }

  return (
    <div
      data-ach-id={achievement.id}
      draggable={!isEditing}
      onDragStart={(e) => !isEditing && onDragStart(e, achievement)}
      onDragEnd={onDragEnd}
      onClick={() => !isEditing && onActivate(achievement.id)}
      className={cn(
        'group bg-surface-container-lowest p-4 rounded-xl shadow-sm border transition-all cursor-grab active:cursor-grabbing',
        isActive
          ? 'border-indigo-300 ring-2 ring-indigo-200 shadow-md bg-indigo-50/30'
          : 'border-transparent hover:border-primary/20 hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <span
          className="material-symbols-outlined text-slate-300 group-hover:text-slate-400 text-base flex-shrink-0 mt-0.5 transition-colors cursor-grab"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          drag_indicator
        </span>

        {/* Tier dot */}
        <span
          className={cn('w-[6px] h-[6px] rounded-full flex-shrink-0 mt-[6px]', dotClass)}
        />

        {/* Text content — normal view or inline edit */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                if (e.key === 'Escape') { setEditText(achievement.text); setIsEditing(false) }
              }}
              rows={3}
              className="w-full text-xs text-on-surface leading-snug resize-none rounded-lg border border-primary/30 bg-surface-container px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          ) : (
            <p className="text-xs font-medium text-on-surface leading-snug">
              {achievement.text}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-surface-container-high rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {label}
            </span>
            {isEditing && (
              <button
                onClick={handleSaveEdit}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-bold hover:bg-primary/20 transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Recover button — only in ignored view */}
        {isIgnoredTab && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(achievement.id) }}
            title="Restore to library"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 transition-colors flex-shrink-0 ml-1"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>undo</span>
          </button>
        )}

        {/* Draft action buttons: edit / confirm / ignore */}
        {isDraftsTab && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {/* Edit */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isEditing) {
                  handleSaveEdit()
                } else {
                  setEditText(achievement.text)
                  setIsEditing(true)
                }
              }}
              title={isEditing ? 'Save edit' : 'Edit achievement'}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                isEditing
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 text-slate-300 hover:text-slate-500'
              )}
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: `'FILL' ${isEditing ? 1 : 0}` }}
              >
                edit
              </span>
            </button>
            {/* Confirm */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onConfirm(achievement.id)
              }}
              title="Confirm achievement"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 transition-colors"
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                check
              </span>
            </button>
            {/* Ignore */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onIgnore(achievement.id)
              }}
              title="Ignore achievement"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors"
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                close
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
