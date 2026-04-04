'use client'

import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { Search, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import type { Achievement, AchievementTier } from '@/lib/types/domain'

const TIER_COLORS: Record<AchievementTier, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-red-400'
}

// Tier labels resolved at render time via i18n (see AchievementCard)

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

  // Flatten and filter achievements
  const allAchievements = experiences.flatMap(
    (exp) => exp.achievements ?? []
  )

  const filtered = allAchievements.filter((a) => {
    if (activeTab === 'drafts') return a.status === 'draft'
    if (activeTab === 'library') return a.status === 'confirmed'
    return true
  }).filter((a) =>
    searchQuery
      ? a.text.toLowerCase().includes(searchQuery.toLowerCase())
      : true
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
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['library', 'drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'text-brand border-b-2 border-brand'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t(`workspace.achievement_panel.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('workspace.achievement_panel.search_placeholder')}
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Achievement list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
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

      {/* Drag hint */}
      <div className="px-3 py-1.5 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          {t('workspace.achievement_panel.drag_hint')}
        </p>
      </div>
    </div>
  )
}

function AchievementCard({
  achievement,
  onDragStart
}: {
  achievement: Achievement
  onDragStart: (e: React.DragEvent, a: Achievement) => void
}) {
  const t = useTranslations()
  const tierKey = `workspace.achievement_panel.tier_labels.tier${achievement.tier}` as const

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, achievement)}
      className="flex items-start gap-2 p-2.5 bg-white border border-gray-100 rounded-lg cursor-grab hover:border-brand hover:shadow-sm active:cursor-grabbing transition-all group"
    >
      {/* Tier indicator */}
      <div
        className={cn(
          'w-2 h-2 rounded-full flex-shrink-0 mt-1',
          TIER_COLORS[achievement.tier as AchievementTier]
        )}
        title={t(tierKey)}
      />

      {/* Text */}
      <p className="flex-1 text-xs text-gray-700 leading-relaxed">
        {achievement.text}
      </p>

      {/* Drag handle */}
      <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
