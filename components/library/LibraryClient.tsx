'use client'

import { NavBar } from '@/components/layout/NavBar'
import { useEffect, useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface AchievementRow {
  id: string
  text: string
  status: 'draft' | 'confirmed' | 'ignored'
  tier: 1 | 2 | 3
  has_placeholders: boolean
  ai_score: number | null
  source: string
  project_name: string | null
  is_featured: boolean
  created_at: string
  experience_id: string
  work_experiences: {
    company: string
    job_title: string
    original_tenure: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
  }
}

type FilterTab = 'all' | 'confirmed' | 'draft' | 'ignored'

const TIER_COLORS: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-amber-400',
  3: 'bg-rose-400',
}
const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-amber-50 text-amber-700',
  ignored: 'bg-gray-50 text-gray-400',
}

export default function LibraryClient() {
  const router = useRouter()
  const t = useTranslations('library')
  const [achievements, setAchievements] = useState<AchievementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Auth gate: only logged-in users can access the library
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login?next=/library')
          return
        }
        // Authenticated: fetch achievements (server uses auth session cookie)
        const res = await fetch('/api/achievements')
        if (res.ok) {
          const { data } = await res.json() as { data: AchievementRow[] }
          setAchievements(data ?? [])
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = achievements.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false
    if (search && !a.text.toLowerCase().includes(search.toLowerCase()) &&
        !a.work_experiences?.company.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    all: achievements.length,
    confirmed: achievements.filter(a => a.status === 'confirmed').length,
    draft: achievements.filter(a => a.status === 'draft').length,
    ignored: achievements.filter(a => a.status === 'ignored').length,
  }

  const handleStatusChange = async (id: string, newStatus: 'confirmed' | 'ignored') => {
    // Optimistic update
    setAchievements(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    try {
      await fetch(`/api/achievements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch { /* silent */ }
  }

  return (
    <div className="bg-[#fcf8ff] text-[#1b1b24] min-h-screen">
      <NavBar />
      <div className="flex pt-20">
        {/* Sidebar */}
        <aside className="fixed left-0 top-20 flex flex-col pt-8 px-4 h-screen w-64 border-r border-slate-100 bg-slate-50">
          <div className="mb-8 px-4">
            <h3 className="font-headline text-sm font-medium uppercase tracking-widest text-slate-400">{t('sidebar_title')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('count_total', { count: counts.all })}</p>
          </div>
          <nav className="space-y-1">
            {(['all', 'confirmed', 'draft', 'ignored'] as FilterTab[]).map(tab => {
              const labels: Record<FilterTab, string> = {
                all: t('filter_all'), confirmed: t('filter_confirmed'), draft: t('filter_draft'), ignored: t('filter_ignored')
              }
              const icons: Record<FilterTab, string> = {
                all: 'apps', confirmed: 'verified', draft: 'edit_note', ignored: 'archive'
              }
              const isActive = filter === tab
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-xl font-headline text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:bg-indigo-50/50'
                  )}
                >
                  <span className="material-symbols-outlined">{icons[tab]}</span>
                  {labels[tab]}
                  <span className={cn(
                    'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
                    isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                  )}>
                    {counts[tab]}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="ml-64 flex-1 p-12 min-h-screen">
          <header className="mb-8">
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-[#1b1b24] mb-2">{t('title')}</h1>
            <p className="text-lg text-[#464555] font-medium opacity-80">{t('subtitle')}</p>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: t('stat_all'), value: counts.all, icon: 'emoji_events', color: 'text-indigo-600' },
              { label: t('stat_confirmed'), value: counts.confirmed, icon: 'verified', color: 'text-emerald-600' },
              { label: t('stat_draft'), value: counts.draft, icon: 'pending_actions', color: 'text-amber-600' },
              { label: t('stat_ignored'), value: counts.ignored, icon: 'archive', color: 'text-slate-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-[#c7c4d8]/10 flex flex-col justify-between">
                <p className="text-sm font-bold text-[#777587] uppercase tracking-wider mb-2">{stat.label}</p>
                <div className="flex items-end justify-between">
                  <span className={`text-3xl font-extrabold font-headline ${stat.color}`}>{stat.value}</span>
                  <span className={`material-symbols-outlined text-4xl ${stat.color}`} style={{ opacity: 0.2 }}>{stat.icon}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Search */}
          <div className="mb-6 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#777587] group-focus-within:text-[#4F46E5] transition-colors">search</span>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="block w-full pl-12 pr-4 py-4 bg-white border border-[#c7c4d8]/20 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[#1b1b24] font-medium shadow-sm placeholder:text-[#777587]/60"
              placeholder={t('search_placeholder')}
              type="text"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#c7c4d8]/10">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-3xl mr-3">refresh</span>
                <span className="text-sm font-medium">{t('loading')}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3">emoji_events</span>
                <p className="text-sm font-medium">
                  {achievements.length === 0
                    ? t('empty_state') : t('empty_search')}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f2ff]/50">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">{t('col_description')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">{t('col_company')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">{t('col_tier')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587]">{t('col_status')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#777587] text-right">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c7c4d8]/10">
                  {filtered.map(row => (
                    <tr key={row.id} className="group hover:bg-indigo-50/20 transition-colors duration-150">
                      <td className="px-6 py-5 max-w-xs">
                        <p className="text-sm font-semibold text-[#1b1b24] leading-relaxed line-clamp-3">{row.text}</p>
                        {row.project_name && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold">
                            {row.project_name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-[#1b1b24]">{row.work_experiences?.company ?? '—'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{row.work_experiences?.job_title ?? ''}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', TIER_COLORS[row.tier])} />
                          <span className="text-xs text-slate-500">
                            {row.tier === 1 ? t('tier_quantified') : row.tier === 2 ? t('tier_incomplete') : t('tier_descriptive')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', STATUS_STYLE[row.status])}>
                          {row.status === 'confirmed' ? t('status_confirmed') : row.status === 'draft' ? t('status_draft') : t('status_ignored')}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {row.status !== 'confirmed' && (
                            <button
                              onClick={() => handleStatusChange(row.id, 'confirmed')}
                              className="w-8 h-8 flex items-center justify-center hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors rounded-full"
                              title={t('action_confirm')}
                            >
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                          )}
                          {row.status !== 'ignored' && (
                            <button
                              onClick={() => handleStatusChange(row.id, 'ignored')}
                              className="w-8 h-8 flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded-full"
                              title={t('action_ignore')}
                            >
                              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <p className="mt-4 text-xs text-slate-400 text-right">
              {t('count_display', { filtered: filtered.length, total: achievements.length })}
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
