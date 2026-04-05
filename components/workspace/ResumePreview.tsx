'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'

interface ResumePreviewProps {
  anonymousId: string
  userId: string | null
}

export function ResumePreview({ anonymousId, userId }: ResumePreviewProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isZH = locale === 'zh-CN'
  const { editorJson, showPhoto, photoPath, resumeLang, experiences, resumeInfo } =
    useWorkspaceStore()

  // Flatten confirmed achievements grouped by experience
  const confirmedExperiences = experiences.map((exp) => ({
    ...exp,
    achievements: (exp.achievements ?? []).filter(
      (a) => a.status === 'confirmed'
    )
  }))

  return (
    <div className="min-h-full bg-gray-100 flex items-start justify-center p-8">
      {/* A4 paper mockup */}
      <div
        className={cn(
          'resume-preview bg-white shadow-lg w-[794px] min-h-[1123px] p-12 relative',
          'select-none'
        )}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header: Name + Contact + Photo */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">
              {resumeInfo?.name || (isZH ? '未识别姓名' : 'Name not detected')}
            </h1>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              {resumeInfo?.email && <span>{resumeInfo.email}</span>}
              {resumeInfo?.phone && <span>{resumeInfo.phone}</span>}
              {resumeInfo?.location && <span>{resumeInfo.location}</span>}
              {resumeInfo?.linkedin && (
                <span className="text-blue-600">{resumeInfo.linkedin}</span>
              )}
              {resumeInfo?.website && (
                <span className="text-blue-600">{resumeInfo.website}</span>
              )}
            </div>
          </div>

          {/* Photo placeholder */}
          {showPhoto && (
            <div className="w-20 h-24 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
              {photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPath}
                  alt="Profile"
                  className="w-full h-full object-cover rounded"
                  draggable={false}
                />
              ) : (
                <span className="text-xs text-gray-400 text-center px-1">
                  {t('workspace.resume_preview.photo_upload')}
                </span>
              )}
            </div>
          )}
        </div>

        <hr className="border-gray-200 mb-6" />

        {/* Work experiences */}
        {confirmedExperiences.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <p>{t('workspace.resume_preview.generating')}</p>
            <p className="text-xs mt-1">{t('workspace.resume_preview.wait')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1">
              {t('workspace.resume_preview.experience_title')}
            </h2>
            {confirmedExperiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between items-baseline mb-1">
                  <div>
                    <span className="font-semibold text-sm text-gray-900">
                      {exp.company}
                    </span>
                    <span className="text-sm text-gray-600 ml-2">
                      {exp.job_title}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {exp.original_date_text || (
                      <>
                        {exp.start_month ? `${exp.start_year}.${exp.start_month.toString().padStart(2, '0')}` : exp.start_year}
                        {' – '}
                        {exp.end_year 
                          ? (exp.end_month ? `${exp.end_year}.${exp.end_month.toString().padStart(2, '0')}` : `${exp.end_year}`) 
                          : t('workspace.resume_preview.present')
                        }
                      </>
                    )}
                  </span>
                </div>
                <ul className="space-y-1 mt-1.5">
                  {exp.achievements.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5',
                          a.tier === 1 && 'bg-green-500',
                          a.tier === 2 && 'bg-yellow-500',
                          a.tier === 3 && 'bg-red-400'
                        )}
                      />
                      <span className="leading-relaxed">{a.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Anti-copy notice */}
        <div className="absolute bottom-4 right-4">
          <span className="text-xs text-gray-300">{t('workspace.resume_preview.copy_notice')}</span>
        </div>
      </div>
    </div>
  )
}
