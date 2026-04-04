'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { Search, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkExperience, Achievement, AchievementTier, Profile } from '@/lib/types/domain'

interface LibraryClientProps {
  experiences: WorkExperience[]
  profile: Profile | null
  userId: string
}

type TierFilter = 'all' | 1 | 2 | 3

const TIER_COLORS: Record<AchievementTier, string> = {
  1: 'bg-achievement-tier1',
  2: 'bg-achievement-tier2',
  3: 'bg-achievement-tier3'
}

const TIER_BADGE_COLORS: Record<AchievementTier, string> = {
  1: 'bg-green-50 text-achievement-tier1 border-green-200',
  2: 'bg-yellow-50 text-achievement-tier2 border-yellow-200',
  3: 'bg-red-50 text-achievement-tier3 border-red-200'
}

export function LibraryClient({ experiences, profile: _profile, userId: _userId }: LibraryClientProps) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')

  const allAchievements = useMemo(() =>
    experiences.flatMap(exp =>
      (exp.achievements ?? [])
        .filter(a => a.status === 'confirmed')
        .map(a => ({ ...a, company: exp.company, job_title: exp.job_title }))
    ), [experiences])

  const filtered = useMemo(() =>
    allAchievements.filter(a => {
      const matchesTier = tierFilter === 'all' || a.tier === tierFilter
      const matchesSearch = !search ||
        a.text.toLowerCase().includes(search.toLowerCase()) ||
        a.company.toLowerCase().includes(search.toLowerCase())
      return matchesTier && matchesSearch
    }), [allAchievements, tierFilter, search])

  const tierCounts = useMemo(() => ({
    1: allAchievements.filter(a => a.tier === 1).length,
    2: allAchievements.filter(a => a.tier === 2).length,
    3: allAchievements.filter(a => a.tier === 3).length
  }), [allAchievements])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">
          {t('library.title')}
        </h1>
        <p className="text-sm text-gray-500">{t('library.subtitle')}</p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-achievement-tier1" />
          <span className="text-xs text-gray-600">{t('library.filter_tier1')} · {tierCounts[1]}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-achievement-tier2" />
          <span className="text-xs text-gray-600">{t('library.filter_tier2')} · {tierCounts[2]}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-achievement-tier3" />
          <span className="text-xs text-gray-600">{t('library.filter_tier3')} · {tierCounts[3]}</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('library.search_placeholder')}
            className="flex-1 text-sm bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {(['all', 1, 2, 3] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                tierFilter === tier
                  ? 'bg-brand text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {tier === 'all' ? t('library.filter_all') : (
                <span className="flex items-center gap-1">
                  <span className={cn('w-1.5 h-1.5 rounded-full', TIER_COLORS[tier as AchievementTier])} />
                  T{tier}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🏆</div>
          <p className="text-gray-500 text-sm mb-4">{t('library.empty_state')}</p>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('library.go_workspace')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(achievement => (
            <AchievementRow key={achievement.id} achievement={achievement} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function AchievementRow({
  achievement,
  t
}: {
  achievement: Achievement & { company: string; job_title: string }
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-brand hover:shadow-sm transition-all group">
      {/* Tier dot */}
      <div className={cn(
        'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5',
        TIER_COLORS[achievement.tier as AchievementTier]
      )} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-relaxed">{achievement.text}</p>
        <p className="text-xs text-gray-400 mt-1">{achievement.company} · {achievement.job_title}</p>
      </div>

      {/* Tier badge */}
      <span className={cn(
        'flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium',
        TIER_BADGE_COLORS[achievement.tier as AchievementTier]
      )}>
        {t(`library.tier_badge.${achievement.tier}`)}
      </span>
    </div>
  )
}
