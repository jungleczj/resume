'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'

interface ResumePreviewProps {
  anonymousId: string
  userId: string | null
}

export function ResumePreview({ anonymousId: _anonymousId, userId: _userId }: ResumePreviewProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isZH = locale === 'zh-CN'
  const {
    showPhoto,
    photoPath,
    experiences,
    resumePersonalInfo,
    resumeEducation,
    resumeSkills
  } = useWorkspaceStore()

  const confirmedExperiences = experiences.map((exp) => ({
    ...exp,
    achievements: (exp.achievements ?? []).filter((a) => a.status === 'confirmed')
  }))

  const hasData = !!resumePersonalInfo || confirmedExperiences.length > 0

  return (
    <div className="min-h-full bg-gray-100 flex items-start justify-center p-8">
      <div
        className={cn('resume-preview bg-white shadow-lg w-[794px] min-h-[1123px] p-12 relative', 'select-none')}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!hasData ? (
          // Empty state — no placeholder names
          <div className="text-center py-16 text-gray-400 text-sm">
            <p>{t('workspace.resume_preview.generating')}</p>
            <p className="text-xs mt-1">{t('workspace.resume_preview.wait')}</p>
          </div>
        ) : (
          <>
            {/* Header: Name + Contact + Photo */}
            <div className="flex items-start justify-between mb-6">
              <div>
                {resumePersonalInfo?.name && (
                  <h1 className="font-display text-2xl font-bold text-gray-900">
                    {resumePersonalInfo.name}
                  </h1>
                )}
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                  {resumePersonalInfo?.email && <span>{resumePersonalInfo.email}</span>}
                  {resumePersonalInfo?.phone && <span>{resumePersonalInfo.phone}</span>}
                  {resumePersonalInfo?.linkedin && <span>{resumePersonalInfo.linkedin}</span>}
                  {resumePersonalInfo?.location && <span>{resumePersonalInfo.location}</span>}
                  {resumePersonalInfo?.website && <span>{resumePersonalInfo.website}</span>}
                </div>
                {resumePersonalInfo?.summary && (
                  <p className="mt-2 text-sm text-gray-600 max-w-xl leading-relaxed">
                    {resumePersonalInfo.summary}
                  </p>
                )}
              </div>

              {showPhoto && (
                <div className="w-20 h-24 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 ml-4">
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

            {/* Work Experience */}
            {confirmedExperiences.length > 0 && (
              <div className="space-y-6 mb-8">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1">
                  {t('workspace.resume_preview.experience_title')}
                </h2>
                {confirmedExperiences.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex justify-between items-baseline mb-1">
                      <div>
                        <span className="font-semibold text-sm text-gray-900">{exp.company}</span>
                        <span className="text-sm text-gray-600 ml-2">{exp.job_title}</span>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {exp.start_year ?? ''}
                        {exp.is_current
                          ? ` – ${t('workspace.resume_preview.present')}`
                          : exp.end_year
                            ? ` – ${exp.end_year}`
                            : ''}
                      </span>
                    </div>
                    <ul className="space-y-1 mt-1.5">
                      {exp.achievements.map((a) => (
                        <li key={a.id} className="flex items-start gap-2 text-sm text-gray-700">
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

            {/* Education */}
            {resumeEducation.length > 0 && (
              <div className="space-y-3 mb-8">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1">
                  {isZH ? '教育背景' : 'Education'}
                </h2>
                {resumeEducation.map((edu, i) => (
                  <div key={i} className="flex justify-between items-baseline">
                    <div>
                      <span className="font-semibold text-sm text-gray-900">{edu.school}</span>
                      {(edu.degree || edu.major) && (
                        <span className="text-sm text-gray-600 ml-2">
                          {[edu.degree, edu.major].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    {(edu.start_year || edu.end_year) && (
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {edu.start_year ?? ''}{edu.end_year ? ` – ${edu.end_year}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {resumeSkills.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
                  {isZH ? '技能与证书' : 'Skills & Certifications'}
                </h2>
                <div className="space-y-2">
                  {resumeSkills.map((group, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-semibold text-gray-700 whitespace-nowrap">{group.category}:</span>
                      <span className="text-gray-600">{group.items.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="absolute bottom-4 right-4">
          <span className="text-xs text-gray-300">{t('workspace.resume_preview.copy_notice')}</span>
        </div>
      </div>
    </div>
  )
}
