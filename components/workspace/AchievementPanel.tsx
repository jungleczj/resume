'use client'

import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import type { Achievement, AchievementTier } from '@/lib/types/domain'

// Icon per tier to visually distinguish, matching Stitch icon style
const TIER_ICONS: Record<AchievementTier, { icon: string; bg: string; color: string }> = {
  1: { icon: 'insights',      bg: 'bg-tertiary-container/10', color: 'text-on-tertiary-fixed-variant' },
  2: { icon: 'code',          bg: 'bg-indigo-100',            color: 'text-indigo-600' },
  3: { icon: 'attach_money',  bg: 'bg-emerald-100',           color: 'text-emerald-600' },
}

export function AchievementPanel() {
  const t = useTranslations()
  const {
    experiences,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    anonymousId
  } = useWorkspaceStore()

  const allAchievements = experiences.flatMap((exp) => exp.achievements ?? [])

  const filtered = allAchievements.filter((a) => {
    if (activeTab === 'drafts') return a.status === 'draft'
    if (activeTab === 'library') return a.status === 'confirmed'
    return true
  }).filter((a) =>
    searchQuery ? a.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  const handleDragStart = (e: React.DragEvent, achievement: Achievement) => {
    e.dataTransfer.setData('application/json', JSON.stringify(achievement))
    trackEvent('achievement_dragged', {
      anonymous_id: anonymousId,
      action: 'drag_start',
      from_tab: activeTab,
      tier: achievement.tier
    })
  }

  return (
    <section className="flex-1 flex flex-col bg-surface-container-high/30 rounded-t-[2.5rem] p-6 shadow-inner overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-6 mb-6">
        {(['library', 'drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'font-headline text-sm font-bold pb-2 relative transition-colors',
              activeTab === tab
                ? 'text-primary font-extrabold after:content-[\'\'] after:absolute after:bottom-0 after:left-0 after:w-full after:h-1 after:bg-primary after:rounded-full'
                : 'text-slate-400 hover:text-on-surface'
            )}
          >
            {t(`workspace.achievement_panel.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('workspace.achievement_panel.search_placeholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-full text-xs border-none focus:ring-2 focus:ring-primary/20 shadow-sm focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            {t('workspace.achievement_panel.empty_state')}
          </div>
        ) : (
          filtered.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AchievementCard({
  achievement,
  onDragStart
}: {
  achievement: Achievement
  onDragStart: (e: React.DragEvent, a: Achievement) => void
}) {
  const tier = (achievement.tier as AchievementTier) ?? 3
  const { icon, bg, color } = TIER_ICONS[tier]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, achievement)}
      className="group bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-1 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
          <span
            className={cn('material-symbols-outlined text-sm', color)}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-on-surface leading-snug">
            {achievement.text}
          </p>
          <div className="mt-2 flex gap-2">
            <span className="px-2 py-0.5 bg-surface-container-high rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {tier === 1 ? 'Impact' : tier === 2 ? 'Growth' : 'Experience'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
