'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onSuccess: (anonymousId: string) => void
  onNotionClick?: () => void
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc']
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function UploadZone({ onSuccess, onNotionClick }: UploadZoneProps) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setError(null)
      setUploading(true)

      const anonymousId = getAnonymousId()

      await trackEvent('f1_upload_started', {
        file_type: file.type,
        file_size: file.size,
        anonymous_id: anonymousId
      })

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('anonymous_id', anonymousId)

        const res = await fetch('/api/resume/upload', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error ?? 'Upload failed')
        }

        onSuccess(data.data?.anonymous_id ?? anonymousId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [onSuccess]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
    noClick: true
  })

  return (
    <div className="w-full">
      {/* Upload container with glow */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200" />
        <div className="relative bg-surface-container-lowest rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              'w-full max-w-2xl border-2 border-dashed rounded-2xl p-10 flex flex-col items-center transition-all duration-200',
              isDragActive
                ? 'border-primary/70 bg-primary/5'
                : 'border-outline-variant/50 hover:border-primary/50',
              uploading && 'pointer-events-none opacity-70'
            )}
          >
            <input {...getInputProps()} />

            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-sm font-medium text-on-surface-variant">{t('status.uploading')}</p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary scale-110 transition-transform">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
                </div>
                <p className="text-base font-bold text-primary font-headline">Drop to upload</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 mb-2 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
                </div>
                <h3 className="text-2xl font-bold text-on-surface font-headline">
                  {t('landing.hero.drop_title')}
                </h3>
                <p className="text-on-surface-variant text-sm mb-4">
                  {t('landing.hero.drop_subtitle')}
                </p>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={open}
                    className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm text-on-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 100%)' }}
                  >
                    <span>{t('landing.hero.cta_upload')}</span>
                    <span className="material-symbols-outlined text-lg">attach_file</span>
                  </button>
                  {onNotionClick && (
                    <button
                      onClick={onNotionClick}
                      className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm border border-outline-variant hover:bg-surface-container-high transition-all text-on-surface"
                    >
                      <span className="material-symbols-outlined text-lg">description</span>
                      <span>{t('landing.hero.cta_notion')}</span>
                    </button>
                  )}
                </div>

                <p className="mt-6 text-xs font-medium uppercase tracking-widest text-outline">
                  {t('landing.hero.upload_hint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-error text-center">{error}</p>
      )}
    </div>
  )
}

function getAnonymousId(): string {
  let id = localStorage.getItem('cf_anonymous_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('cf_anonymous_id', id)
  }
  return id
}
