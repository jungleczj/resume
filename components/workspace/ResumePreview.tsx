'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Achievement, ResumePersonalInfo, LanguageProficiency } from '@/lib/types/domain'
import { PhotoCropModal } from './PhotoCropModal'
import { trackEvent } from '@/lib/analytics'

// ─── Inline-editable text cell ───────────────────────────────────────────────
// Allows cursor + typing (select-text) but copy events are blocked document-wide.
function EditableCell({
  value,
  onSave,
  className,
  placeholder = '',
  multiline = false,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const focused = useRef(false)

  // Sync external value when not in edit mode
  useEffect(() => {
    if (ref.current && !focused.current) {
      if (ref.current.textContent !== (value ?? '')) {
        ref.current.textContent = value ?? ''
      }
    }
  }, [value])

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      onFocus={() => { focused.current = true }}
      onBlur={(e) => {
        focused.current = false
        const v = (e.currentTarget.textContent ?? '').trim()
        if (v !== (value ?? '')) onSave(v)
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        // Block Ctrl/Cmd+C and Ctrl/Cmd+X at keystroke level
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onCopy={(e) => { e.preventDefault(); e.stopPropagation() }}
      onCut={(e) => { e.preventDefault(); e.stopPropagation() }}
      onPaste={(e) => {
        // Strip formatting — allow plain text paste only
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      className={cn('editable-cell select-text cursor-text outline-none', className)}
    />
  )
}

// ─── Highlighted editable cell (tier-2 placeholder orange rendering) ─────────
// Shows [[type:description]] placeholders in orange when not editing.
// Falls back to raw text (contentEditable) when clicked.
function HighlightedEditableCell({
  value,
  onSave,
  className,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const spanRef = useRef<HTMLSpanElement>(null)

  // Sync text on mount and when switching into edit mode
  useEffect(() => {
    if (editing && spanRef.current) {
      spanRef.current.textContent = value
      spanRef.current.focus()
      // Move cursor to end
      const range = document.createRange()
      range.selectNodeContents(spanRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Parse [[type:description]] segments for display
  function parseSegments(text: string) {
    return text.split(/(\[\[.*?\]\])/g).map((part, i) =>
      /^\[\[.*?\]\]$/.test(part) ? (
        <mark
          key={i}
          style={{
            background: 'rgba(251,146,60,0.12)',
            color: '#c2410c',
            borderRadius: 3,
            padding: '0 3px',
            fontStyle: 'italic',
          }}
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  if (!editing) {
    return (
      <span
        className={cn('cursor-text outline-none select-text', className)}
        onClick={() => setEditing(true)}
        onCopy={(e) => { e.preventDefault(); e.stopPropagation() }}
        onCut={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        {parseSegments(value)}
      </span>
    )
  }

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      className={cn('outline-none cursor-text select-text', className)}
      onBlur={(e) => {
        setEditing(false)
        const v = (e.currentTarget.textContent ?? '').trim()
        if (v !== value) onSave(v)
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
          e.preventDefault(); e.stopPropagation()
        }
      }}
      onCopy={(e) => { e.preventDefault(); e.stopPropagation() }}
      onCut={(e) => { e.preventDefault(); e.stopPropagation() }}
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
    />
  )
}

// ─── Main template component ─────────────────────────────────────────────────
export function ResumePreview() {
  const t = useTranslations()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  const {
    showPhoto,
    photoPath,
    setPhotoPath,
    experiences,
    resumePersonalInfo,
    resumeEducation,
    resumeSkills,
    resumeCertifications,
    resumeLanguages,
    resumeAwards,
    resumePublications,
    resumeLang,
    anonymousId,
    userId,
    updatePersonalInfoField,
    updateExperienceField,
    updateAchievementText,
    updateEducation,
    updateSkills,
    replaceAchievementInResume,
    insertAchievementInResume,
    pendingDropTarget,
    setPendingDropTarget,
    pendingInsertTarget,
    setPendingInsertTarget,
    translatedTexts,
    activeAchievementId,
    setActiveAchievementId,
    ignoreAchievement,
  } = useWorkspaceStore()

  // Derive display flags from resumeLang (not locale)
  const isZH = resumeLang === 'zh' || resumeLang === 'bilingual'
  const isBilingual = resumeLang === 'bilingual'

  // Section header helper: bilingual shows "EN / 中文"
  const sectionLabel = (zh: string, en: string) =>
    isBilingual ? `${en} / ${zh}` : isZH ? zh : en

  // ── Scroll resume to active achievement (set from panel click) ───────────
  useEffect(() => {
    if (!activeAchievementId) return
    const li = document.querySelector(`[data-resume-ach-id="${activeAchievementId}"]`) as HTMLElement | null
    li?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeAchievementId])

  // ── Block all clipboard copy/cut document-wide while mounted ──────────────
  // Capture phase fires before any element handler; stopImmediatePropagation
  // prevents other listeners from seeing the event at all.
  useEffect(() => {
    const block = (e: ClipboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      // Overwrite clipboard data as belt-and-suspenders safety
      try { e.clipboardData?.clearData() } catch { /* ignore */ }
    }
    document.addEventListener('copy', block as EventListener, true)
    document.addEventListener('cut', block as EventListener, true)
    return () => {
      document.removeEventListener('copy', block as EventListener, true)
      document.removeEventListener('cut', block as EventListener, true)
    }
  }, [])

  // Step 1: file selected → open crop modal
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    setCropFile(file)
    // Reset input so the same file can be selected again if cancelled
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // Step 2: crop confirmed → upload blob
  const handleCroppedBlob = async (blob: Blob) => {
    setCropFile(null)
    setPhotoUploading(true)
    try {
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      if (anonymousId) form.append('anonymous_id', anonymousId)
      if (userId) form.append('user_id', userId)
      const res = await fetch('/api/resume/photo', { method: 'POST', body: form })
      if (res.ok) {
        const { url } = await res.json()
        if (url) {
          setPhotoPath(url)
          trackEvent('photo_uploaded', {
            anonymous_id: anonymousId ?? undefined,
            user_id: userId ?? undefined,
          })
        }
      }
    } catch { /* silent */ } finally {
      setPhotoUploading(false)
    }
  }

  const confirmedExps = experiences
    .map((exp) => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter((a) => a.status === 'confirmed'),
    }))
    .filter((exp) => exp.achievements.length > 0)

  const hasData = !!resumePersonalInfo || confirmedExps.some((e) => e.achievements.length > 0)

  // Safe string getter for personal info fields
  const pInfo = (field: keyof ResumePersonalInfo): string => {
    const val = resumePersonalInfo?.[field]
    return val == null ? '' : String(val)
  }

  return (
    <div className="min-h-full bg-[#f0f2f5] flex items-start justify-center p-8 pb-16">
      {/* A4 paper */}
      <div
        className="bg-white shadow-xl relative select-none"
        style={{ width: 794, minHeight: 1123, padding: '52px 56px' }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {!hasData ? (
          /* ── Empty / loading state ── */
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm mt-20">
            <span className="material-symbols-outlined text-5xl text-gray-200 mb-3">description</span>
            <p className="font-medium">
              {isZH ? 'AI 正在解析简历...' : 'AI is processing your resume...'}
            </p>
            <p className="text-xs mt-1 text-gray-300">
              {isZH ? '内容将自动出现在此处' : 'Content will appear here automatically'}
            </p>
          </div>
        ) : (
          <>
            {/* ══ HEADER ═══════════════════════════════════════════════════ */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1 min-w-0 pr-4">
                {/* Name */}
                <h1 className="text-[22px] font-bold text-gray-900 leading-snug mb-1.5">
                  <EditableCell
                    value={pInfo('name')}
                    onSave={(v) => updatePersonalInfoField('name', v)}
                    placeholder={isZH ? '姓名' : 'Your Name'}
                    className="font-bold text-[22px]"
                  />
                </h1>

                {/* Contact row — always render all fields with placeholders */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
                  <EditableCell
                    value={pInfo('email')}
                    onSave={(v) => updatePersonalInfoField('email', v)}
                    placeholder="email"
                  />
                  <span className="text-gray-200 select-none">·</span>
                  <EditableCell
                    value={pInfo('phone')}
                    onSave={(v) => updatePersonalInfoField('phone', v)}
                    placeholder={isZH ? '电话' : 'phone'}
                  />
                  <span className="text-gray-200 select-none">·</span>
                  <EditableCell
                    value={pInfo('location')}
                    onSave={(v) => updatePersonalInfoField('location', v)}
                    placeholder={isZH ? '城市' : 'location'}
                  />
                  <span className="text-gray-200 select-none">·</span>
                  <EditableCell
                    value={pInfo('linkedin')}
                    onSave={(v) => updatePersonalInfoField('linkedin', v)}
                    placeholder="LinkedIn"
                    className="text-indigo-500"
                  />
                  <span className="text-gray-200 select-none">·</span>
                  <EditableCell
                    value={pInfo('website')}
                    onSave={(v) => updatePersonalInfoField('website', v)}
                    placeholder="website"
                    className="text-indigo-500"
                  />
                </div>

                {/* Summary */}
                <p className="mt-2.5 text-[12px] text-gray-600 leading-relaxed">
                  <EditableCell
                    value={pInfo('summary')}
                    onSave={(v) => updatePersonalInfoField('summary', v)}
                    placeholder={isZH ? '个人简介（可直接点击编辑）' : 'Professional summary (click to edit)'}
                    multiline
                    className="block w-full"
                  />
                </p>
              </div>

              {/* Photo slot — click to upload */}
              {showPhoto && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoFileChange}
                  />
                  <div
                    onClick={() => !photoUploading && photoInputRef.current?.click()}
                    className={cn(
                      'w-[72px] h-[88px] flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center relative group cursor-pointer',
                      photoUploading && 'opacity-60'
                    )}
                    title={isZH ? '点击上传照片' : 'Click to upload photo'}
                  >
                    {photoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPath}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-300 text-center px-1 leading-tight">
                        {isZH ? '照片' : 'Photo'}
                      </span>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="material-symbols-outlined text-white text-lg">
                        {photoUploading ? 'hourglass_empty' : 'upload'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Thin accent divider */}
            <div className="h-[1.5px] bg-gradient-to-r from-indigo-500 via-indigo-300 to-transparent mb-5" />

            {/* ══ EDUCATION ════════════════════════════════════════════════ */}
            {resumeEducation.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel('教育背景', 'Education')}
                </h2>
                <div className="space-y-2.5">
                  {resumeEducation.map((edu, i) => {
                    const gpaRankParts: string[] = []
                    if (edu.gpa_score) {
                      gpaRankParts.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
                    }
                    if (edu.class_rank_text) gpaRankParts.push(edu.class_rank_text)
                    if (edu.minor_subject) gpaRankParts.push(isZH ? `辅修：${edu.minor_subject}` : `Minor: ${edu.minor_subject}`)
                    if (edu.academic_honors) gpaRankParts.push(edu.academic_honors)
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-baseline gap-2 min-w-0 flex-1">
                            <EditableCell
                              value={edu.school}
                              onSave={(v) => {
                                const updated = [...resumeEducation]
                                updated[i] = { ...edu, school: v }
                                updateEducation(updated)
                              }}
                              placeholder={isZH ? '学校名称' : 'School'}
                              className="font-semibold text-[13px] text-gray-900"
                            />
                            {(edu.degree || edu.major) && (
                              <>
                                <span className="text-gray-300 select-none text-[12px]">·</span>
                                <EditableCell
                                  value={[edu.degree, edu.major].filter(Boolean).join(' ')}
                                  onSave={(v) => {
                                    const parts = v.trim().split(/\s+/)
                                    const updated = [...resumeEducation]
                                    updated[i] = {
                                      ...edu,
                                      degree: parts[0] ?? null,
                                      major: parts.slice(1).join(' ') || null,
                                    }
                                    updateEducation(updated)
                                  }}
                                  placeholder={isZH ? '学历 专业' : 'Degree Major'}
                                  className="text-[13px] text-gray-600"
                                />
                              </>
                            )}
                          </div>
                          <EditableCell
                            value={[edu.start_year, edu.end_year].filter(Boolean).join(' – ')}
                            onSave={(v) => {
                              const parts = v.split(/[-–—]/).map((s) => parseInt(s.trim(), 10))
                              const updated = [...resumeEducation]
                              updated[i] = {
                                ...edu,
                                start_year: isNaN(parts[0]) ? null : parts[0],
                                end_year: parts[1] && !isNaN(parts[1]) ? parts[1] : null,
                              }
                              updateEducation(updated)
                            }}
                            placeholder="2020 – 2024"
                            className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0"
                          />
                        </div>
                        {gpaRankParts.length > 0 && (
                          <p className="text-[11px] text-gray-400 pl-0.5">
                            {gpaRankParts.join(' · ')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ══ WORK EXPERIENCE ══════════════════════════════════════════ */}
            {confirmedExps.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel('工作经历', 'Work Experience')}
                </h2>
                <div className="space-y-5">
                  {confirmedExps.map((exp) => (
                    <div key={exp.id}>
                      {/* Company · Role row */}
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <div className="flex items-baseline gap-2 min-w-0 flex-1">
                          <EditableCell
                            value={exp.company}
                            onSave={(v) => updateExperienceField(exp.id, 'company', v)}
                            placeholder={isZH ? '公司名称' : 'Company'}
                            className="font-semibold text-[13px] text-gray-900"
                          />
                          <span className="text-gray-300 select-none text-[12px]">·</span>
                          <EditableCell
                            value={exp.job_title}
                            onSave={(v) => updateExperienceField(exp.id, 'job_title', v)}
                            placeholder={isZH ? '职位' : 'Title'}
                            className="text-[13px] text-gray-600"
                          />
                        </div>
                        <EditableCell
                          value={exp.original_tenure ?? ''}
                          onSave={(v) => updateExperienceField(exp.id, 'original_tenure', v)}
                          placeholder={isZH ? '任期' : 'Tenure'}
                          className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0"
                        />
                      </div>

                      {/* Achievement bullets — grouped by project_name */}
                      {exp.achievements.length > 0 && (() => {
                        // Group consecutive achievements by project_name
                        type ProjectGroup = { project_name: string | null; project_member_role: string | null; items: Achievement[] }
                        const groups: ProjectGroup[] = []
                        for (const a of exp.achievements) {
                          const last = groups[groups.length - 1]
                          if (last && last.project_name === (a.project_name ?? null)) {
                            last.items.push(a)
                          } else {
                            groups.push({ project_name: a.project_name ?? null, project_member_role: a.project_member_role ?? null, items: [a] })
                          }
                        }
                        return (
                          <div className="space-y-2">
                            {groups.map((group, gi) => (
                              <div key={gi}>
                                {/* Project sub-header (only when project_name is set) */}
                                {group.project_name && (
                                  <div className="flex items-center gap-1.5 mb-1 mt-1.5">
                                    <span className="text-[11px] text-indigo-400 font-medium select-none">▸</span>
                                    <span className="text-[11px] text-indigo-500 font-medium tracking-wide">
                                      {group.project_name}
                                    </span>
                                    {group.project_member_role && (
                                      <>
                                        <span className="text-gray-300 select-none text-[10px]">·</span>
                                        <span className="text-[11px] text-gray-400">
                                          {group.project_member_role}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                                <ul className="space-y-[5px] pl-1">
                                  {group.items.map((a) => {
                                    const isDropTarget = pendingDropTarget === a.id
                                    const isActive = activeAchievementId === a.id
                                    return (
                                      <li
                                        key={a.id}
                                        data-resume-ach-id={a.id}
                                        onClick={() => {
                                          const nextActive = isActive ? null : a.id
                                          setActiveAchievementId(nextActive)
                                          if (nextActive) {
                                            trackEvent('achievement_highlighted', {
                                              anonymous_id: anonymousId ?? undefined,
                                              achievement_id: a.id,
                                              from: 'resume',
                                            })
                                          }
                                        }}
                                        className={cn(
                                          'flex items-start gap-2 rounded transition-all duration-150 cursor-pointer',
                                          isDropTarget && 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-50/60',
                                          isActive && !isDropTarget && 'ring-2 ring-indigo-300 ring-offset-1 bg-indigo-50/40'
                                        )}
                                        onDragOver={(e) => {
                                          e.preventDefault()
                                          e.dataTransfer.dropEffect = 'copy'
                                          if (pendingDropTarget !== a.id) setPendingDropTarget(a.id)
                                        }}
                                        onDragLeave={(e) => {
                                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            setPendingDropTarget(null)
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault()
                                          setPendingDropTarget(null)
                                          try {
                                            const raw = e.dataTransfer.getData('application/json')
                                            if (!raw) return
                                            const newAch = JSON.parse(raw) as Achievement
                                            replaceAchievementInResume(exp.id, a.id, newAch)
                                          } catch {
                                            // Malformed drag data — ignore
                                          }
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            'w-[5px] h-[5px] rounded-full flex-shrink-0 mt-[6px]',
                                            a.tier === 1 && 'bg-emerald-500',
                                            a.tier === 2 && 'bg-amber-400',
                                            a.tier === 3 && 'bg-rose-400'
                                          )}
                                        />
                                        {(() => {
                                          // Use translated text when lang is 'en'/'bilingual' and a translation exists
                                          const displayText = translatedTexts[a.id] ?? a.text
                                          return a.tier === 2 && a.has_placeholders && !translatedTexts[a.id] ? (
                                            <HighlightedEditableCell
                                              value={displayText}
                                              onSave={(v) => updateAchievementText(exp.id, a.id, v)}
                                              className="text-[12.5px] text-gray-700 leading-relaxed flex-1"
                                            />
                                          ) : (
                                            <EditableCell
                                              value={displayText}
                                              onSave={(v) => updateAchievementText(exp.id, a.id, v)}
                                              multiline
                                              className="text-[12.5px] text-gray-700 leading-relaxed flex-1"
                                            />
                                          )
                                        })()}
                                        {/* Delete button — only shown when this achievement is selected */}
                                        {isActive && (
                                          <button
                                            onMouseDown={(e) => {
                                              // mouseDown fires before blur on editable cells; stop propagation
                                              e.stopPropagation()
                                              e.preventDefault()
                                              ignoreAchievement(a.id)
                                              setActiveAchievementId(null)
                                            }}
                                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors select-none"
                                            title={isZH ? '从简历中移除' : 'Remove from resume'}
                                          >
                                            <span className="text-[13px] leading-none font-medium select-none">×</span>
                                          </button>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* ── INSERT drop zone ── drag an achievement here to append it */}
                      {(() => {
                        const isInsertTarget = pendingInsertTarget === exp.id
                        return (
                          <div
                            className={cn(
                              'mt-1.5 h-6 rounded flex items-center justify-center text-[10px] transition-all duration-150 border border-dashed',
                              isInsertTarget
                                ? 'border-indigo-400 bg-indigo-50/60 text-indigo-400'
                                : 'border-transparent text-transparent'
                            )}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'copy'
                              if (pendingInsertTarget !== exp.id) setPendingInsertTarget(exp.id)
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setPendingInsertTarget(null)
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              setPendingInsertTarget(null)
                              try {
                                const raw = e.dataTransfer.getData('application/json')
                                if (!raw) return
                                const newAch = JSON.parse(raw) as Achievement
                                insertAchievementInResume(exp.id, newAch)
                              } catch { /* ignore */ }
                            }}
                          >
                            {isInsertTarget ? (isZH ? '+ 追加成就' : '+ Add here') : ''}
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ══ SKILLS ═══════════════════════════════════════════════════ */}
            {resumeSkills.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel('技能', 'Skills')}
                </h2>
                <div className="space-y-1.5">
                  {resumeSkills.map((group, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[12.5px]">
                      <EditableCell
                        value={group.category}
                        onSave={(v) => {
                          const updated = [...resumeSkills]
                          updated[i] = { ...group, category: v }
                          updateSkills(updated)
                        }}
                        placeholder={isZH ? '分类' : 'Category'}
                        className="font-semibold text-gray-800 whitespace-nowrap flex-shrink-0"
                      />
                      <span className="text-gray-300 select-none flex-shrink-0">:</span>
                      <EditableCell
                        value={group.items.join(' · ')}
                        onSave={(v) => {
                          const updated = [...resumeSkills]
                          updated[i] = {
                            ...group,
                            items: v.split(/[·,，、]/).map((s) => s.trim()).filter(Boolean),
                          }
                          updateSkills(updated)
                        }}
                        placeholder={isZH ? '技能1 · 技能2' : 'Skill1 · Skill2'}
                        className="text-gray-600"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ══ CERTIFICATIONS ═══════════════════════════════════════════ */}
            {resumeCertifications.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel(t('workspace.resume_preview.certifications'), t('workspace.resume_preview.certifications'))}
                </h2>
                <div className="space-y-1.5">
                  {resumeCertifications.map((cert, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                        <span className="font-medium text-gray-800">{cert.name}</span>
                        {cert.issuing_org && (
                          <>
                            <span className="text-gray-300 select-none">·</span>
                            <span className="text-gray-500 text-[11.5px]">{cert.issuing_org}</span>
                          </>
                        )}
                      </div>
                      {cert.issue_year && (
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {cert.issue_year}
                          {cert.expiry_year ? ` – ${cert.expiry_year}` : (cert.is_current ? (isZH ? ' – 持续有效' : ' – No Expiry') : '')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ══ SPOKEN LANGUAGES ═════════════════════════════════════════ */}
            {resumeLanguages.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel(t('workspace.resume_preview.spoken_languages'), t('workspace.resume_preview.spoken_languages'))}
                </h2>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  {resumeLanguages.map((lang, i) => {
                    const profLabel = t(`workspace.resume_preview.proficiency.${lang.proficiency as LanguageProficiency}`)
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[12.5px]">
                        <span className="font-medium text-gray-800">{lang.language_name}</span>
                        <span className="text-gray-300 select-none">·</span>
                        <span className="text-gray-500 text-[11.5px]">
                          {lang.is_native ? (isZH ? '母语' : 'Native') : profLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ══ AWARDS & HONORS ══════════════════════════════════════════ */}
            {resumeAwards.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel(t('workspace.resume_preview.awards'), t('workspace.resume_preview.awards'))}
                </h2>
                <div className="space-y-1.5">
                  {resumeAwards.map((award, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                        <span className="font-medium text-gray-800">{award.title}</span>
                        {award.issuing_org && (
                          <>
                            <span className="text-gray-300 select-none">·</span>
                            <span className="text-gray-500 text-[11.5px]">{award.issuing_org}</span>
                          </>
                        )}
                      </div>
                      {award.award_year && (
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{award.award_year}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ══ PUBLICATIONS ═════════════════════════════════════════════ */}
            {resumePublications.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-3 select-none">
                  {sectionLabel(t('workspace.resume_preview.publications'), t('workspace.resume_preview.publications'))}
                </h2>
                <div className="space-y-2.5">
                  {resumePublications.map((pub, i) => (
                    <div key={i} className="text-[12px] text-gray-700 leading-relaxed">
                      <span className="font-medium text-gray-800">{pub.title}</span>
                      {pub.publication_venue && (
                        <span className="text-gray-500"> · {pub.publication_venue}</span>
                      )}
                      {pub.pub_year && (
                        <span className="text-gray-400"> · {pub.pub_year}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Protection watermark */}
        <div className="absolute bottom-4 right-5 select-none pointer-events-none">
          <span className="text-[9px] text-gray-200 tracking-wide">CareerFlow · Protected</span>
        </div>
      </div>

      {/* Global styles for editable cells */}
      <style jsx global>{`
        .editable-cell {
          border-radius: 3px;
          padding: 0 2px;
          margin: 0 -2px;
          min-width: 4px;
          display: inline;
          transition: background 0.1s;
        }
        .editable-cell:hover {
          background-color: rgba(238, 242, 255, 0.7);
        }
        .editable-cell:focus {
          background-color: rgba(224, 231, 255, 0.6);
          box-shadow: 0 0 0 1.5px rgba(129, 140, 248, 0.4);
          outline: none;
        }
        .editable-cell[data-ph]:empty::before {
          content: attr(data-ph);
          color: #d1d5db;
          pointer-events: none;
          font-style: italic;
          font-weight: normal;
        }
      `}</style>

      {/* Photo crop modal — rendered outside the A4 paper so it's full-screen */}
      {cropFile && (
        <PhotoCropModal
          file={cropFile}
          onConfirm={handleCroppedBlob}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  )
}
