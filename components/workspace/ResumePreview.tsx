'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'
import type { Achievement, ResumePersonalInfo } from '@/lib/types/domain'
import { PhotoCropModal } from './PhotoCropModal'
import { trackEvent } from '@/lib/analytics'
import { COBALT } from '@/lib/styles/resume-theme'

// ─── Inline-editable text cell ───────────────────────────────────────────────
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
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onCopy={(e) => { e.preventDefault(); e.stopPropagation() }}
      onCut={(e) => { e.preventDefault(); e.stopPropagation() }}
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      className={cn('editable-cell select-text cursor-text outline-none', className)}
    />
  )
}

// ─── Highlighted editable cell (tier-2 placeholder orange rendering) ─────────
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

  useEffect(() => {
    if (editing && spanRef.current) {
      spanRef.current.textContent = value
      spanRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(spanRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  function parseSegments(text: string) {
    // Order matters: match [[...]] before [...] to avoid confusing double-bracket placeholders
    return text.split(/(\[\[.*?\]\]|\{\{.*?\}\}|\[(?!\[)[^\]]*\])/g).map((part, i) => {
      // [[type:description]] — orange placeholder (user must fill in)
      if (/^\[\[.*?\]\]$/.test(part)) {
        return (
          <mark
            key={i}
            style={{
              background: 'rgba(251,146,60,0.15)',
              color: '#c2410c',
              borderRadius: 3,
              padding: '0 3px',
              fontStyle: 'italic',
            }}
          >
            {part}
          </mark>
        )
      }
      // {{...}} — blue highlight (key metric or suggestion)
      if (/^\{\{.*?\}\}$/.test(part)) {
        return (
          <mark
            key={i}
            style={{
              background: 'transparent',
              color: C.accent,
              fontWeight: 700,
              padding: 0,
            }}
          >
            {part.slice(2, -2)}
          </mark>
        )
      }
      // [...] — green AI-addition marker (content the AI added, not in original)
      if (/^\[(?!\[)[^\]]*\]$/.test(part)) {
        return (
          <mark
            key={i}
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#059669',
              borderRadius: 3,
              padding: '0 2px',
              fontStyle: 'normal',
            }}
          >
            {part.slice(1, -1)}
          </mark>
        )
      }
      return <span key={i}>{part}</span>
    })
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

// ─── Proficiency labels ───────────────────────────────────────────────────────
const PROFICIENCY_LABELS: Record<string, { zh: string; en: string }> = {
  elementary:           { zh: '初级',     en: 'Elementary' },
  limited_working:      { zh: '日常沟通', en: 'Limited Working' },
  professional_working: { zh: '工作交流', en: 'Professional' },
  full_professional:    { zh: '流利',     en: 'Full Professional' },
  native_bilingual:     { zh: '母语',     en: 'Native' },
}

// ─── Cobalt theme tokens (single source: lib/styles/resume-theme.ts) ─────────
const C = COBALT

// ─── Section heading (left sidebar) ──────────────────────────────────────────
function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "'Noto Serif', serif",
      fontWeight: 700,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: C.textBright,
      borderLeft: `3px solid ${C.accent}`,
      paddingLeft: 8,
      marginBottom: 8,
    }}>
      {children}
    </h3>
  )
}

// ─── Section heading (right main) ────────────────────────────────────────────
function MainHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <h3 style={{
        fontFamily: "'Noto Serif', serif",
        fontWeight: 700,
        fontSize: 15,
        color: C.textBright,
        whiteSpace: 'nowrap',
      }}>
        {children}
      </h3>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

// ─── Main template component ─────────────────────────────────────────────────
export function ResumePreview() {
  const outerRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragCounterRef = useRef(0)
  // Scale the A4 canvas to fit the right panel while keeping A4 proportions
  const [scale, setScale] = useState(1)
  const [paperHeight, setPaperHeight] = useState(1123)
  // Per-section pixel offsets injected before rendering to push content past page boundaries
  const [pageSpacers, setPageSpacers] = useState<Record<string, number>>({})

  // Multi-page layout constants (used by both layout JSX and pagination measurement)
  const PAGE_H = 1123
  const PAGE_GAP = 20

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
    originalPersonalInfo,
    originalEducation,
    originalSkills,
    translatedCertifications,
    translatedAwards,
    translatedPublications,
    translatedLanguages,
    translatedExperiences,
    translatedProjectNames,
  } = useWorkspaceStore()

  const isZH = resumeLang === 'zh' || resumeLang === 'bilingual'
  const isBilingual = resumeLang === 'bilingual'
  // true for both 'en' and 'bilingual' — controls whether translated overlays are used
  const showTranslated = resumeLang !== 'zh'

  const sectionLabel = (zh: string, en: string) =>
    isBilingual ? `${en} / ${zh}` : isZH ? zh : en

  // Scroll to active achievement
  useEffect(() => {
    if (!activeAchievementId) return
    const li = document.querySelector(`[data-resume-ach-id="${activeAchievementId}"]`) as HTMLElement | null
    li?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeAchievementId])

  // ── Scale preview to fit the container ──────────────────────────────────
  // The A4 canvas is always 794px wide; we scale it down to fit the panel.
  // p-8 (32px each side) = 64px total horizontal padding subtracted from available width.
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const ro = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - 64 // subtract p-8*2
      setScale(available > 0 && available < 794 ? available / 794 : 1)
    })
    ro.observe(outer)
    // Initial calculation
    const initial = outer.clientWidth - 64
    setScale(initial > 0 && initial < 794 ? initial / 794 : 1)
    return () => ro.disconnect()
  }, [])

  // Track actual paper height so marginBottom collapses layout space correctly
  useEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const ro = new ResizeObserver(([entry]) => {
      setPaperHeight(entry.contentRect.height || 1123)
    })
    ro.observe(paper)
    return () => ro.disconnect()
  }, [])

  // ── Page-break logic: reset cached spacers whenever layout-affecting data changes
  useLayoutEffect(() => {
    setPageSpacers({})
  }, [
    experiences,
    resumePersonalInfo,
    resumeEducation,
    resumeSkills,
    resumeCertifications,
    resumeLanguages,
    resumeAwards,
    resumePublications,
    resumeLang,
    showPhoto,
    photoPath,
    translatedTexts,
    translatedExperiences,
    translatedCertifications,
    translatedAwards,
    translatedPublications,
    translatedLanguages,
    translatedProjectNames,
    originalPersonalInfo,
    originalEducation,
    originalSkills,
  ])

  // ── Page-break logic: measure each [data-section] and push it past gap zones
  // Sidebar (aside) and main (article) flow independently, so cumulative push is tracked per-column.
  useLayoutEffect(() => {
    if (Object.keys(pageSpacers).length > 0 || !paperRef.current) return
    const STEP = PAGE_H + PAGE_GAP
    const paperRect = paperRef.current.getBoundingClientRect()
    const sections = Array.from(
      paperRef.current.querySelectorAll('[data-section]')
    ) as HTMLElement[]

    const cumulativeByCol = new Map<Element | null, number>()
    const newSpacers: Record<string, number> = {}

    sections.forEach((s) => {
      const id = s.getAttribute('data-section-id')
      if (!id) return
      const col = s.closest('aside, article')
      const cumulative = cumulativeByCol.get(col) || 0
      const rect = s.getBoundingClientRect()
      const top = rect.top - paperRect.top + cumulative
      const height = rect.height
      // Skip overlong sections (allow internal split rather than wasting a page)
      if (height > PAGE_H) return
      const pageIdx = Math.floor(top / STEP)
      const pageEnd = pageIdx * STEP + PAGE_H
      if (top + height > pageEnd) {
        const newTop = (pageIdx + 1) * STEP
        const push = newTop - top
        newSpacers[id] = push
        cumulativeByCol.set(col, cumulative + push)
      }
    })

    if (Object.keys(newSpacers).length > 0) {
      setPageSpacers(newSpacers)
    }
  }, [pageSpacers])

  // Block all clipboard copy/cut document-wide while mounted
  useEffect(() => {
    const block = (e: ClipboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      try { e.clipboardData?.clearData() } catch { /* ignore */ }
    }
    document.addEventListener('copy', block as EventListener, true)
    document.addEventListener('cut', block as EventListener, true)
    return () => {
      document.removeEventListener('copy', block as EventListener, true)
      document.removeEventListener('cut', block as EventListener, true)
    }
  }, [])

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setPhotoError(isZH ? '仅支持 JPG / PNG 格式' : 'Only JPG / PNG supported')
      setTimeout(() => setPhotoError(null), 3000)
      if (photoInputRef.current) photoInputRef.current.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError(isZH ? '文件不能超过 2MB' : 'File must be under 2 MB')
      setTimeout(() => setPhotoError(null), 3000)
      if (photoInputRef.current) photoInputRef.current.value = ''
      return
    }
    setPhotoError(null)
    setCropFile(file)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

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
      } else {
        let msg = isZH ? '照片上传失败，请重试' : 'Photo upload failed, please retry'
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
        setPhotoError(msg)
        setTimeout(() => setPhotoError(null), 4000)
      }
    } catch {
      setPhotoError(isZH ? '网络错误，请重试' : 'Network error, please retry')
      setTimeout(() => setPhotoError(null), 4000)
    } finally {
      setPhotoUploading(false)
    }
  }

  const confirmedExps = experiences
    .map((exp) => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter((a) => a.status === 'confirmed'),
    }))
    .filter((exp) => exp.achievements.length > 0)

  // Build a fast lookup map: expId → translated fields
  const translatedExpMap = Object.fromEntries(
    (translatedExperiences ?? []).map(t => [t.id, t])
  )

  // Helper: get translated value for an experience field, fallback to original
  const expField = (expId: string, field: 'job_title' | 'company', fallback: string) => {
    if (!showTranslated) return fallback
    return translatedExpMap[expId]?.[field] ?? fallback
  }

  // Helper: translate "至今" / "现在" in tenure strings to "Present" for EN/bilingual
  const translateTenure = (tenure: string | null | undefined): string => {
    if (!tenure) return ''
    if (!showTranslated) return tenure
    return tenure.replace(/至今|现在/g, 'Present')
  }

  const hasData = !!resumePersonalInfo || confirmedExps.some((e) => e.achievements.length > 0)

  // Pages drawn behind the resume content (incl. spacer-pushed content)
  const pageCount = Math.max(1, Math.ceil(paperHeight / PAGE_H))
  const totalVisualHeight = pageCount * PAGE_H + (pageCount - 1) * PAGE_GAP

  // CSS mask that hides content falling in gap zones (y = n*1123 to n*1123+PAGE_GAP).
  // This prevents content from visually bleeding into the gray inter-page strips.
  const paperMask = pageCount > 1 ? (() => {
    const stops: string[] = ['black 0']
    for (let i = 0; i < pageCount - 1; i++) {
      const gapStart = (i + 1) * 1123 + i * PAGE_GAP
      const gapEnd = gapStart + PAGE_GAP
      stops.push(`black ${gapStart}px`, `transparent ${gapStart}px`, `transparent ${gapEnd}px`, `black ${gapEnd}px`)
    }
    stops.push('black')
    return `linear-gradient(to bottom, ${stops.join(', ')})`
  })() : undefined

  const pInfo = (field: keyof ResumePersonalInfo): string => {
    const val = resumePersonalInfo?.[field]
    return val == null ? '' : String(val)
  }

  // Contact items for sidebar
  const contactItems = [
    { icon: 'mail', value: pInfo('email'), field: 'email' as const, placeholder: 'email' },
    { icon: 'call', value: pInfo('phone'), field: 'phone' as const, placeholder: isZH ? '电话' : 'phone' },
    { icon: 'location_on', value: pInfo('location'), field: 'location' as const, placeholder: isZH ? '城市' : 'location' },
    { icon: 'link', value: pInfo('linkedin'), field: 'linkedin' as const, placeholder: 'LinkedIn / GitHub' },
    { icon: 'public', value: pInfo('website'), field: 'website' as const, placeholder: 'website' },
  ]

  return (
    <div ref={outerRef} className="min-h-full flex items-start justify-center p-8 pb-16" style={{ background: C.surfaceDark }}>
      {/* Load Cobalt fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
        .cobalt-resume * { box-sizing: border-box; }
        .editable-cell {
          border-radius: 2px;
          padding: 0 2px;
          margin: 0 -2px;
          min-width: 4px;
          display: inline;
          transition: background 0.1s;
        }
        .editable-cell:hover { background-color: rgba(37,99,235,0.07); }
        .editable-cell:focus {
          background-color: rgba(37,99,235,0.1);
          box-shadow: 0 0 0 1.5px rgba(37,99,235,0.35);
          outline: none;
        }
        .editable-cell[data-ph]:empty::before {
          content: attr(data-ph);
          color: #cbd5e1;
          pointer-events: none;
          font-style: italic;
          font-weight: normal;
        }
      `}</style>

      {/* ── Page layout wrapper: scale transform + page-sheet backgrounds ──────── */}
      <div
        id="resume-paper-wrapper"
        style={{
          position: 'relative',
          width: 794,
          height: totalVisualHeight,
          // Scale to fit panel width while keeping A4 ratio
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
          // Collapse unused layout space so the scroll container matches visual height
          marginBottom: scale < 1 ? `${(scale - 1) * totalVisualHeight}px` : undefined,
        }}
      >
        {/* Individual A4 page backgrounds — white paper sheets behind the content */}
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={`page-bg-${i}`}
            data-html2canvas-ignore="true"
            style={{
              position: 'absolute',
              top: i * (1123 + PAGE_GAP),
              left: 0,
              width: 794,
              height: 1123,
              background: '#ffffff',
              boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ))}

        {/* Gap strips between pages — gray band with page number label */}
        {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
          <div
            key={`page-gap-${i}`}
            data-html2canvas-ignore="true"
            style={{
              position: 'absolute',
              top: (i + 1) * 1123 + i * PAGE_GAP,
              left: 0,
              right: 0,
              height: PAGE_GAP,
              background: C.surfaceDark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingInline: 10,
              zIndex: 5,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.06em', userSelect: 'none' }}>
              ─── Page {i + 1} ───
            </span>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.08em', userSelect: 'none' }}>
              PAGE {i + 2}
            </span>
          </div>
        ))}

        {/* Resume content — transparent bg, overflow visible, z-index above page backgrounds */}
        <div
          id="resume-paper"
          ref={paperRef}
          className={cn('cobalt-resume select-none', dragActive && 'ring-2 ring-blue-300/50')}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 794,
            minHeight: 1123,
            background: 'transparent',
            color: C.textMain,
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            zIndex: 2,
            maskImage: paperMask,
            WebkitMaskImage: paperMask,
          }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onDragEnter={(e) => {
          e.preventDefault()
          dragCounterRef.current++
          if (!dragActive) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          dragCounterRef.current--
          if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragActive(false) }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => { dragCounterRef.current = 0; setDragActive(false) }}
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
            {/* ══ HEADER STRIP ══════════════════════════════════════════════ */}
            <header style={{ background: '#ffffff', borderBottom: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 36px 14px' }}>
                <h1 style={{
                  fontFamily: "'Noto Serif', serif",
                  fontWeight: 900,
                  fontSize: 13,
                  color: C.accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                  <EditableCell
                    value={pInfo('name')}
                    onSave={(v) => updatePersonalInfoField('name', v)}
                    placeholder={isZH ? '姓名' : 'Your Name'}
                  />
                </h1>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: `${C.textMain}80`, letterSpacing: '0.1em' }}>
                  CV_2024
                </span>
              </div>
              <div style={{ height: 2, background: C.accent, margin: '0 36px', opacity: 0.5 }} />
            </header>

            {/* ══ TWO-COLUMN BODY ═══════════════════════════════════════════ */}
            <div style={{ display: 'flex', flex: 1, padding: '28px 36px 28px' }}>

              {/* ── LEFT SIDEBAR (32%) ──────────────────────────────────── */}
              <aside style={{ width: '32%', flexShrink: 0, paddingRight: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Photo + Name + Title */}
                <div
                  data-section
                  data-section-id="sidebar-identity"
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '18px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    marginTop: pageSpacers['sidebar-identity'] || 0,
                  }}
                >
                  {/* Photo slot */}
                  {showPhoto && (
                    <>
                      <div className="relative" style={{ alignSelf: 'flex-start' }}>
                        {photoError && (
                          <div style={{ position: 'absolute', bottom: '105%', right: 0, zIndex: 10 }}>
                            <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                              {photoError}
                            </span>
                          </div>
                        )}
                        <div
                          onClick={() => !photoUploading && photoInputRef.current?.click()}
                          title={isZH ? '点击上传照片' : 'Click to upload photo'}
                          style={{
                            width: 80,
                            height: 96,
                            borderRadius: 6,
                            background: '#ffffff',
                            border: `1px solid ${C.border}`,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            opacity: photoUploading ? 0.6 : 1,
                          }}
                          className="group"
                        >
                          {photoPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoPath}
                              alt="Profile"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%)' }}
                              draggable={false}
                            />
                          ) : (
                            <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', padding: '0 4px', lineHeight: 1.4 }}>
                              {isZH ? '照片' : 'Photo'}
                            </span>
                          )}
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(0,0,0,0.28)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.15s',
                            pointerEvents: 'none',
                          }} className="group-hover:opacity-100">
                            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18 }}>
                              {photoUploading ? 'hourglass_empty' : 'upload'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Name + Title */}
                  <div>
                    <h2 style={{
                      fontFamily: "'Noto Serif', serif",
                      fontWeight: 700,
                      fontSize: 18,
                      color: C.accent,
                      lineHeight: 1.25,
                      marginBottom: 3,
                    }}>
                      <EditableCell
                        value={pInfo('name')}
                        onSave={(v) => updatePersonalInfoField('name', v)}
                        placeholder={isZH ? '姓名' : 'Your Name'}
                      />
                    </h2>
                    {confirmedExps[0]?.job_title && (
                      <p style={{ fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9, color: C.textMain }}>
                        {expField(confirmedExps[0].id, 'job_title', confirmedExps[0].job_title)}
                      </p>
                    )}
                  </div>

                  {/* Contact info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {contactItems.map(({ icon, value, field, placeholder }) => (
                      <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: `${C.textMain}cc` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: C.accent, flexShrink: 0 }}>{icon}</span>
                        <EditableCell
                          value={value}
                          onSave={(v) => updatePersonalInfoField(field, v)}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                {resumeSkills.length > 0 && (
                  <div
                    data-section
                    data-section-id="sidebar-skills"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      marginTop: pageSpacers['sidebar-skills'] || 0,
                    }}
                  >
                    <SidebarHeading>{sectionLabel('核心技能', 'Core Skills')}</SidebarHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {resumeSkills.map((group, i) => {
                        const origSkill = originalSkills?.[i]
                        const zhGroup = isBilingual && origSkill ? origSkill : group
                        return (
                          <div key={i}>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: `${C.accent}b3`, marginBottom: 5 }}>
                              <EditableCell
                                value={zhGroup.category}
                                onSave={(v) => {
                                  const updated = [...resumeSkills]
                                  updated[i] = { ...group, category: v }
                                  updateSkills(updated)
                                }}
                                placeholder={isZH ? '分类' : 'Category'}
                              />
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {zhGroup.items.map((item, j) => (
                                <span key={j} style={{
                                  padding: '2px 7px',
                                  background: C.surface,
                                  color: C.textMain,
                                  fontSize: 9,
                                  fontWeight: 500,
                                  borderRadius: 3,
                                  border: `1px solid ${C.border}`,
                                }}>
                                  {item}
                                </span>
                              ))}
                            </div>
                            {isBilingual && origSkill && group.category !== origSkill.category && (
                              <p style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{group.category}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Certifications + Awards combined */}
                {(resumeCertifications.length > 0 || resumeAwards.length > 0) && (
                  <div
                    data-section
                    data-section-id="sidebar-cert-awards"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: pageSpacers['sidebar-cert-awards'] || 0,
                    }}
                  >
                    <SidebarHeading>{sectionLabel('证书与荣誉', 'Awards & Certs')}</SidebarHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resumeCertifications.map((cert, i) => {
                        const tCert = translatedCertifications?.[i]
                        const displayName = showTranslated && tCert?.name ? tCert.name : cert.name
                        const displayCertOrg = showTranslated && tCert?.issuing_org != null ? tCert.issuing_org : cert.issuing_org
                        return (
                          <div key={i} style={{
                            background: `${C.surface}80`,
                            border: `1px solid ${C.border}`,
                            borderRadius: 3,
                            padding: '5px 8px',
                          }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: C.textBright }}>{displayName}</p>
                            {cert.issue_year && (
                              <p style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                                {displayCertOrg ? `${displayCertOrg} · ` : ''}{cert.issue_year}
                              </p>
                            )}
                          </div>
                        )
                      })}
                      {resumeAwards.map((award, i) => {
                        const tAward = translatedAwards?.[i]
                        const displayTitle = showTranslated && tAward?.title ? tAward.title : award.title
                        const displayAwardOrg = showTranslated && tAward?.issuing_org != null ? tAward.issuing_org : award.issuing_org
                        return (
                          <div key={i} style={{
                            background: `${C.surface}80`,
                            border: `1px solid ${C.border}`,
                            borderRadius: 3,
                            padding: '5px 8px',
                          }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: C.textBright }}>{displayTitle}</p>
                            {award.award_year && (
                              <p style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                                {displayAwardOrg ? `${displayAwardOrg} · ` : ''}{award.award_year}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {resumeLanguages.length > 0 && (
                  <div
                    data-section
                    data-section-id="sidebar-languages"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: pageSpacers['sidebar-languages'] || 0,
                    }}
                  >
                    <SidebarHeading>{sectionLabel('语言能力', 'Languages')}</SidebarHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resumeLanguages.map((lang, i) => {
                        const tLang = translatedLanguages?.[i]
                        const displayName = showTranslated && tLang?.language_name ? tLang.language_name : lang.language_name
                        const prof = PROFICIENCY_LABELS[lang.proficiency]
                        const profLabel = lang.is_native
                          ? (showTranslated ? 'Native' : '母语')
                          : prof
                            ? (showTranslated ? prof.en : prof.zh)
                            : lang.proficiency
                        return (
                          <div key={i} style={{
                            background: `${C.surface}80`,
                            border: `1px solid ${C.border}`,
                            borderRadius: 3,
                            padding: '5px 8px',
                          }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: C.textBright }}>
                              {displayName}
                              {profLabel && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 4 }}>({profLabel})</span>}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </aside>

              {/* ── RIGHT MAIN CONTENT (68%) ─────────────────────────────── */}
              <article style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Executive Summary */}
                {pInfo('summary') && (
                  <section
                    data-section
                    data-section-id="main-summary"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${C.accent}`,
                      borderRadius: 5,
                      padding: '14px 16px',
                      marginTop: pageSpacers['main-summary'] || 0,
                    }}
                  >
                    <h3 style={{
                      fontFamily: "'Noto Serif', serif",
                      fontWeight: 700,
                      fontSize: 13,
                      color: C.textBright,
                      marginBottom: 7,
                    }}>
                      {sectionLabel('个人简介', 'Executive Summary')}
                    </h3>
                    <p style={{ fontSize: 10.5, lineHeight: 1.65, color: C.textMain }}>
                      <EditableCell
                        value={isBilingual && originalPersonalInfo ? String(originalPersonalInfo.summary ?? '') : pInfo('summary')}
                        onSave={(v) => updatePersonalInfoField('summary', v)}
                        placeholder={isZH ? '个人简介（点击编辑）' : 'Professional summary (click to edit)'}
                        multiline
                        className="block w-full"
                      />
                      {isBilingual && originalPersonalInfo && resumePersonalInfo?.summary && (
                        <span style={{ display: 'block', fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.65, fontStyle: 'italic' }}>
                          {pInfo('summary')}
                        </span>
                      )}
                    </p>
                  </section>
                )}

                {/* Work Experience */}
                {confirmedExps.length > 0 && (
                  <section>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {confirmedExps.map((exp, expIdx) => {
                        const expSid = `main-exp-${exp.id}`
                        return (
                        <div
                          key={exp.id}
                          data-section
                          data-section-id={expSid}
                          style={{ marginTop: pageSpacers[expSid] || 0 }}
                        >
                          {expIdx === 0 && (
                            <MainHeading>{sectionLabel('工作经历', 'Professional Experience')}</MainHeading>
                          )}
                          <div style={{ position: 'relative', paddingLeft: 18 }}>
                          {/* Timeline dot + line */}
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 5,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: expIdx === 0 ? C.accent : C.border,
                            boxShadow: expIdx === 0 ? `0 0 7px ${C.accent}99` : 'none',
                          }} />
                          {expIdx < confirmedExps.length - 1 && (
                            <div style={{
                              position: 'absolute',
                              left: 3.5,
                              top: 14,
                              bottom: -20,
                              width: 1,
                              background: `${C.accent}30`,
                            }} />
                          )}

                          {/* Company + Date row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                            <div>
                              <h4 style={{ fontWeight: 700, fontSize: 12, color: C.textBright, marginBottom: 2 }}>
                                <EditableCell
                                  value={expField(exp.id, 'job_title', exp.job_title)}
                                  onSave={(v) => updateExperienceField(exp.id, 'job_title', v)}
                                  placeholder={isZH ? '职位' : 'Title'}
                                />
                              </h4>
                              <p style={{ fontSize: 10, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                <EditableCell
                                  value={expField(exp.id, 'company', exp.company)}
                                  onSave={(v) => updateExperienceField(exp.id, 'company', v)}
                                  placeholder={isZH ? '公司名称' : 'Company'}
                                />
                              </p>
                            </div>
                            <span style={{
                              fontSize: 9,
                              fontFamily: 'monospace',
                              background: C.surface,
                              border: `1px solid ${C.border}`,
                              color: C.textMain,
                              padding: '2px 7px',
                              borderRadius: 3,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              marginLeft: 8,
                            }}>
                              <EditableCell
                                value={translateTenure(exp.original_tenure)}
                                onSave={(v) => updateExperienceField(exp.id, 'original_tenure', v)}
                                placeholder={isZH ? '任期' : 'Tenure'}
                              />
                            </span>
                          </div>

                          {/* Achievement bullets */}
                          {exp.achievements.length > 0 && (() => {
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
                              <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {groups.map((group, gi) => (
                                  <div key={gi}>
                                    {group.project_name && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, marginTop: 6 }}>
                                        <span style={{ fontSize: 10, color: C.accent, fontWeight: 500 }}>▸</span>
                                        <span style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: '0.04em' }}>
                                          {(showTranslated && translatedProjectNames?.[group.project_name]) || group.project_name}
                                        </span>
                                        {group.project_member_role && (
                                          <>
                                            <span style={{ color: C.border, fontSize: 9 }}>·</span>
                                            <span style={{ fontSize: 10, color: '#64748b' }}>
                                              {(showTranslated && translatedProjectNames?.[group.project_member_role]) || group.project_member_role}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 2 }}>
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
                                            style={{
                                              display: 'flex',
                                              alignItems: 'flex-start',
                                              gap: 7,
                                              borderRadius: 3,
                                              transition: 'all 0.15s',
                                              outline: isDropTarget ? `2px solid ${C.accent}` : isActive ? `2px solid ${C.accent}80` : 'none',
                                              outlineOffset: 2,
                                              background: isDropTarget ? `${C.accent}0d` : isActive ? `${C.accent}08` : 'transparent',
                                              cursor: 'pointer',
                                            }}
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
                                              } catch { /* ignore */ }
                                            }}
                                          >
                                            {/* Accent slash bullet — matching HTML template style */}
                                            <span style={{
                                              color: C.accent,
                                              fontWeight: 900,
                                              fontSize: 11,
                                              lineHeight: '1.6',
                                              flexShrink: 0,
                                              userSelect: 'none',
                                            }}>/</span>
                                            {/* Tier dot */}
                                            <span style={{
                                              width: 5,
                                              height: 5,
                                              borderRadius: '50%',
                                              flexShrink: 0,
                                              marginTop: 7,
                                              background: a.tier === 1 ? '#10b981' : a.tier === 2 ? '#f59e0b' : '#f87171',
                                            }} />
                                            {(() => {
                                              const enText = translatedTexts[a.id]
                                              const hasMarkers = a.has_placeholders || /\{\{.*?\}\}/.test(a.text)
                                              if (isBilingual && enText) {
                                                return (
                                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <EditableCell
                                                      value={a.text}
                                                      onSave={(v) => updateAchievementText(exp.id, a.id, v)}
                                                      multiline
                                                      className="block"
                                                    />
                                                    <div style={{ fontSize: 9.5, color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' }}>{enText}</div>
                                                  </div>
                                                )
                                              }
                                              const displayText = (!isZH && enText) ? enText : a.text
                                              return hasMarkers && !enText ? (
                                                <HighlightedEditableCell
                                                  value={displayText}
                                                  onSave={(v) => updateAchievementText(exp.id, a.id, v)}
                                                  className="flex-1"
                                                />
                                              ) : (
                                                <EditableCell
                                                  value={displayText}
                                                  onSave={(v) => updateAchievementText(exp.id, a.id, v)}
                                                  multiline
                                                  className="flex-1"
                                                />
                                              )
                                            })()}
                                            {isActive && (
                                              <button
                                                onMouseDown={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  ignoreAchievement(a.id)
                                                  setActiveAchievementId(null)
                                                }}
                                                style={{
                                                  flexShrink: 0, width: 18, height: 18,
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  color: '#94a3b8', borderRadius: 3, border: 'none', background: 'transparent',
                                                  cursor: 'pointer', fontSize: 13, fontWeight: 600, userSelect: 'none',
                                                }}
                                                title={isZH ? '从简历中移除' : 'Remove from resume'}
                                                className="hover:text-red-500 hover:bg-red-50 transition-colors"
                                              >
                                                ×
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

                          {/* Insert drop zone */}
                          {(() => {
                            const isInsertTarget = pendingInsertTarget === exp.id
                            return (
                              <div
                                style={{
                                  marginTop: 6,
                                  borderRadius: 3,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 9,
                                  transition: 'all 0.15s',
                                  border: `1px dashed ${isInsertTarget ? C.accent : dragActive ? '#94a3b8' : 'transparent'}`,
                                  height: isInsertTarget ? 28 : dragActive ? 24 : 0,
                                  background: isInsertTarget ? `${C.accent}0d` : 'transparent',
                                  color: isInsertTarget ? C.accent : '#94a3b8',
                                  overflow: 'hidden',
                                }}
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
                                {isInsertTarget
                                  ? (isZH ? '+ 追加成就' : '+ Add here')
                                  : dragActive
                                    ? (isZH ? '拖入此处添加' : 'Drop here to add')
                                    : ''}
                              </div>
                            )
                          })()}
                          </div>
                        </div>
                      )})}
                    </div>
                  </section>
                )}

                {/* Education */}
                {resumeEducation.length > 0 && (
                  <section
                    data-section
                    data-section-id="main-education"
                    style={{ marginTop: pageSpacers['main-education'] || 0 }}
                  >
                    <MainHeading>{sectionLabel('教育背景', 'Academic Background')}</MainHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {resumeEducation.map((edu, i) => {
                        const origEdu = originalEducation?.[i]
                        const zhEdu = isBilingual && origEdu ? origEdu : edu
                        const isFirst = i === 0
                        const gpaRankParts: string[] = []
                        if (edu.gpa_score) gpaRankParts.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
                        if (edu.class_rank_text) gpaRankParts.push(edu.class_rank_text)
                        if (edu.academic_honors) gpaRankParts.push(edu.academic_honors)
                        return (
                          <div key={i} style={{
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            borderBottom: `2px solid ${isFirst ? C.accent : `${C.textMain}30`}`,
                            borderRadius: 5,
                            padding: '12px 14px',
                          }}>
                            {(edu.degree || edu.major) && (
                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.accent, marginBottom: 3 }}>
                                {[zhEdu.degree].filter(Boolean).join('')}
                              </p>
                            )}
                            <h4 style={{ fontWeight: 700, fontSize: 11, color: C.textBright, marginBottom: 2 }}>
                              <EditableCell
                                value={zhEdu.major || zhEdu.school}
                                onSave={(v) => {
                                  const updated = [...resumeEducation]
                                  updated[i] = { ...edu, major: v }
                                  updateEducation(updated)
                                }}
                                placeholder={isZH ? '专业' : 'Major'}
                              />
                            </h4>
                            <p style={{ fontSize: 9.5, color: C.textMain }}>
                              <EditableCell
                                value={zhEdu.school}
                                onSave={(v) => {
                                  const updated = [...resumeEducation]
                                  updated[i] = { ...edu, school: v }
                                  updateEducation(updated)
                                }}
                                placeholder={isZH ? '学校名称' : 'School'}
                              />
                            </p>
                            <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', marginTop: 5 }}>
                              {gpaRankParts.length > 0 && (
                                <span style={{ color: C.accent }}>{gpaRankParts.join(' · ')}</span>
                              )}
                              {gpaRankParts.length > 0 && [edu.start_year, edu.end_year].filter(Boolean).length > 0 && ' • '}
                              <EditableCell
                                value={[edu.start_year, edu.end_year].filter(Boolean).join('–')}
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
                                placeholder="2020–2024"
                              />
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Publications */}
                {resumePublications.length > 0 && (
                  <section
                    data-section
                    data-section-id="main-publications"
                    style={{ marginTop: pageSpacers['main-publications'] || 0 }}
                  >
                    <MainHeading>{sectionLabel('学术成果', 'Publications & Research')}</MainHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {resumePublications.map((pub, i) => {
                        const tPub = translatedPublications?.[i]
                        const displayTitle = showTranslated && tPub?.title ? tPub.title : pub.title
                        const displayVenue = showTranslated && tPub?.publication_venue != null ? tPub.publication_venue : pub.publication_venue
                        return (
                          <div key={i} style={{
                            display: 'flex',
                            gap: 10,
                            padding: '6px 8px',
                            borderRadius: 3,
                            border: `1px solid transparent`,
                            transition: 'all 0.15s',
                          }}
                          className="hover:bg-[#f8fafc] hover:border-[#e2e8f0]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13, color: C.accent, flexShrink: 0, marginTop: 1 }}>description</span>
                            <div>
                              <p style={{ fontSize: 9.5, fontWeight: 700, color: C.textBright }}>{displayTitle}</p>
                              {displayVenue && (
                                <p style={{ fontSize: 9, color: C.textMain, fontStyle: 'italic', marginTop: 2 }}>
                                  {displayVenue}{pub.pub_year ? `, ${pub.pub_year}` : ''}
                                </p>
                              )}
                              {isBilingual && tPub && tPub.title !== pub.title && (
                                <p style={{ fontSize: 9, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>{tPub.title}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </article>
            </div>

            {/* ══ FOOTER ════════════════════════════════════════════════════ */}
            <footer style={{
              borderTop: `1px solid ${C.border}`,
              padding: '10px 36px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 8, fontFamily: 'monospace', color: `${C.textMain}40`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                CareerFlow · Professional Portfolio System · 2024
              </p>
            </footer>
          </>
        )}

        {/* Protection watermark */}
        <div style={{ position: 'absolute', bottom: 12, right: 16, pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{ fontSize: 8, color: `${C.border}`, letterSpacing: '0.05em' }}>CareerFlow · Protected</span>
        </div>
        </div>{/* ─── end #resume-paper ─── */}
      </div>{/* ─── end #resume-paper-wrapper ─── */}

      {/* File input lives outside select-none so browser user-gesture chain is never broken */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }}
        tabIndex={-1}
        aria-hidden
        onChange={handlePhotoFileChange}
      />

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
