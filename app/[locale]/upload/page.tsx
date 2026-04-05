'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { trackEvent } from '@/lib/analytics'
import { NavBar } from '@/components/layout/NavBar'

function getAnonymousId(): string {
  let id = localStorage.getItem('cf_anonymous_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('cf_anonymous_id', id)
  }
  return id
}

export default function UploadPage() {
  const router = useRouter()
  const t = useTranslations('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressWidth, setProgressWidth] = useState(0)

  const handleFile = useCallback(async (file: File) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    if (!allowed.includes(file.type)) {
      setError(t('error_type'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('error_size'))
      return
    }

    setError(null)
    setUploading(true)
    setProgressWidth(20)
    const anonymousId = getAnonymousId()

    await trackEvent('f1_upload_started', {
      file_type: file.type,
      file_size: file.size,
      anonymous_id: anonymousId
    })

    try {
      setProgressWidth(50)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('anonymous_id', anonymousId)

      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData })
      setProgressWidth(90)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('error_upload'))

      setProgressWidth(100)

      const id = data.data?.anonymous_id ?? anonymousId
      await trackEvent('f1_upload_completed', { anonymous_id: id })

      router.push(`/workspace?anonymous_id=${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_upload'))
      setUploading(false)
      setProgressWidth(0)
    }
  }, [router, t])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <NavBar />

      <main className="pt-24 pb-16 px-6 max-w-[1024px] mx-auto">

        {/* Hero Section */}
        <section className="mb-12">
          <h1 className="text-5xl font-extrabold text-on-surface tracking-tight mb-4 font-headline">
            {t('title')}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t('subtitle')}
          </p>
        </section>

        {/* Main Upload Area */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-surface-container-lowest rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all duration-300">

            {/* Drag and Drop Zone */}
            <div
              className="w-full max-w-2xl border-2 border-dashed border-outline-variant/50 hover:border-primary/50 transition-colors rounded-2xl p-10 flex flex-col items-center group/drop"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 mb-6 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary group-hover/drop:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  cloud_upload
                </span>
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-2">{t('drop_title')}</h3>
              <p className="text-on-surface-variant mb-8">{t('drop_subtitle')}</p>

              {error && (
                <p className="text-error text-sm font-medium mb-4">{error}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-3 rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-headline"
                >
                  <span>{t('btn_choose')}</span>
                  <span className="material-symbols-outlined text-lg">attach_file</span>
                </button>
                <button
                  onClick={() => router.push('/login?next=notion')}
                  className="px-8 py-3 rounded-full font-semibold border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-2 font-headline"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  <span>{t('btn_notion')}</span>
                </button>
              </div>

              <p className="mt-8 text-xs font-medium uppercase tracking-widest text-outline">
                {t('hint')}
              </p>
            </div>

            {/* Hidden Input */}
            <input
              ref={fileInputRef}
              accept=".pdf,.docx"
              className="hidden"
              type="file"
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-8 flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
          <div className="w-10 h-10 rounded-full bg-tertiary-container/10 flex items-center justify-center text-on-tertiary-fixed-variant">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-on-surface">
                {uploading ? t('ai_processing') : t('ai_ready_title')}
              </span>
              <span className="text-xs font-bold text-tertiary">
                {uploading ? `${progressWidth}%` : t('ai_ready_rate')}
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-tertiary to-tertiary-container transition-all duration-1000 ease-out"
                style={{ width: uploading ? `${progressWidth}%` : '0%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Recent Uploads Section */}
        <section className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-on-surface font-headline">{t('recent_title')}</h2>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-all">
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button className="p-2 rounded-lg bg-surface-container-high text-primary transition-all">
                <span className="material-symbols-outlined">list</span>
              </button>
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-surface-container-low rounded-3xl p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">folder_open</span>
            <p className="text-on-surface-variant font-medium">{t('empty_state')}</p>
          </div>
        </section>

        {/* Secondary Guidance Section (Bento Grid) */}
        <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gradient-to-br from-primary-container to-primary p-10 rounded-3xl text-on-primary relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-3xl font-extrabold mb-4 leading-tight font-headline">{t('bento1_title')}</h3>
              <p className="text-primary-fixed-dim text-lg mb-8 max-w-md">{t('bento1_desc')}</p>
              <button className="bg-white text-primary px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary-fixed transition-colors font-headline">
                {t('bento1_cta')}
              </button>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 opacity-20 transform translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-[12rem]">query_stats</span>
            </div>
          </div>
          <div className="bg-surface-container-high p-8 rounded-3xl flex flex-col justify-between border border-outline-variant/20">
            <div>
              <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary mb-6">
                <span className="material-symbols-outlined">lightbulb</span>
              </div>
              <h4 className="text-xl font-bold mb-2 font-headline">{t('tip_title')}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t('tip_desc')}</p>
            </div>
            <a className="text-sm font-bold text-primary flex items-center gap-1 mt-4 group" href="#">
              {t('tip_link')}
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          </div>
        </section>
      </main>

      {/* Success Modal */}
    </div>
  )
}
