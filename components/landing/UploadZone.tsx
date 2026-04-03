'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslations } from 'next-intl'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onSuccess: (anonymousId: string) => void
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc']
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function UploadZone({ onSuccess }: UploadZoneProps) {
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

        // Use server-returned anonymous_id (may differ if server generated one)
        onSuccess(data.data?.anonymous_id ?? anonymousId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [onSuccess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'w-full max-w-lg mx-auto border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-brand bg-brand-50'
            : 'border-gray-300 hover:border-brand hover:bg-gray-50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
            <p className="text-sm text-gray-600">{t('status.uploading')}</p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-3">
            <FileText className="w-10 h-10 text-brand" />
            <p className="text-sm text-brand font-medium">松开即可上传</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                拖拽简历至此，或点击上传
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF、Word，最大 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
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
