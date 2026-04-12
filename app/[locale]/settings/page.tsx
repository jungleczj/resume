'use client'

import { useEffect, useState } from 'react'
import { NavBar } from '@/components/layout/NavBar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from '@/lib/i18n/navigation'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/domain'

export default function SettingsPage() {
  const router = useRouter()
  const locale = useLocale()
  const isEN = locale === 'en-US'

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Data export state
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUser(data.user)
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      setProfile(p)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportData = async () => {
    setExporting(true)
    setExportError(null)
    setExportSuccess(false)
    try {
      const res = await fetch('/api/user/export-data')
      if (!res.ok) {
        const { error } = await res.json() as { error?: string }
        throw new Error(error ?? 'Export failed')
      }
      const data = await res.json() as Record<string, unknown>
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `careerflow_data_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportSuccess(true)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json() as { error?: string }
        throw new Error(error ?? 'Deletion failed')
      }
      // Sign out and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed')
      setDeleting(false)
    }
  }

  const isFree = !profile || profile.payment_market === 'cn_free'

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="pt-20 md:pt-24 max-w-2xl mx-auto px-4 pb-12">
        <h1 className="text-2xl font-extrabold text-slate-900 font-headline mb-8">
          {isEN ? 'Settings' : '账号设置'}
        </h1>

        {/* Account Info */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            {isEN ? 'Account' : '账号信息'}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{isEN ? 'Email' : '邮箱'}</span>
              <span className="text-sm font-medium text-slate-800">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{isEN ? 'Plan' : '当前方案'}</span>
              <span className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-full',
                isFree ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'
              )}>
                {isFree ? (isEN ? 'Free' : '免费版') : 'Pro'}
              </span>
            </div>
            {!isFree && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{isEN ? 'Member since' : '注册时间'}</span>
                <span className="text-sm text-slate-600">
                  {new Date(user.created_at).toLocaleDateString(isEN ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long' })}
                </span>
              </div>
            )}
          </div>
          {isFree && !isEN && (
            <button
              onClick={() => router.push('/pricing')}
              className="mt-4 w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              升级到 Pro
            </button>
          )}
        </section>

        {/* GDPR — Data Export */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-1">
            {isEN ? 'Export Your Data' : '导出我的数据'}
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            {isEN
              ? 'Download a copy of all your achievements and resume versions.'
              : '下载你所有成就记录和简历版本的副本。'}
          </p>
          {exportError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{exportError}</p>
          )}
          {exportSuccess && (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">
              {isEN ? 'Download started!' : '已开始下载！'}
            </p>
          )}
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base">download</span>
            )}
            {exporting
              ? (isEN ? 'Preparing...' : '准备中...')
              : (isEN ? 'Export data (JSON)' : '导出数据（JSON）')}
          </button>
        </section>

        {/* Danger Zone — Account Deletion */}
        <section className="bg-white rounded-2xl border border-rose-200 p-6">
          <h2 className="text-sm font-bold text-rose-700 mb-1">
            {isEN ? 'Danger Zone' : '危险操作'}
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            {isEN
              ? 'Deleting your account is permanent. All data will be removed after a 7-day grace period.'
              : '注销账号后，所有数据将在 7 天内被永久删除，无法恢复。'}
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-rose-300 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">delete_forever</span>
              {isEN ? 'Delete account' : '注销账号'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-rose-700">
                {isEN ? 'Type DELETE to confirm:' : '请输入 DELETE 以确认：'}
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-sm border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              {deleteError && (
                <p className="text-xs text-red-500">{deleteError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {deleting && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isEN ? 'Confirm delete' : '确认注销'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null) }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {isEN ? 'Cancel' : '取消'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
