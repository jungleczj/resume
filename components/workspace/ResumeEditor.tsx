'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useWorkspaceStore } from '@/store/workspace'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

interface ResumeEditorProps {
  className?: string
}

export function ResumeEditor({ className }: ResumeEditorProps) {
  const locale = useLocale()
  const isZH = locale === 'zh-CN'
  const editorRef = useRef<HTMLDivElement>(null)
  const [initialized, setInitialized] = useState(false)

  const {
    resumePersonalInfo,
    resumeEducation,
    resumeSkills,
    experiences,
    showPhoto,
    photoPath,
    resumeLang
  } = useWorkspaceStore()

  const confirmedExperiences = experiences.map((exp) => ({
    ...exp,
    achievements: (exp.achievements ?? []).filter((a) => a.status === 'confirmed')
  }))

  const buildInitialContent = useCallback(() => {
    const lang = resumeLang === 'en' ? 'en' : isZH ? 'zh' : 'bilingual'

    const name = resumePersonalInfo?.name || ''
    const email = resumePersonalInfo?.email || ''
    const phone = resumePersonalInfo?.phone || ''
    const location = resumePersonalInfo?.location || ''
    const linkedin = resumePersonalInfo?.linkedin || ''
    const website = resumePersonalInfo?.website || ''
    const summary = resumePersonalInfo?.summary || ''

    const content: Record<string, unknown>[] = []

    content.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: name || (isZH ? '姓名' : 'Name') }]
    })

    const contactParts: string[] = []
    if (email) contactParts.push(email)
    if (phone) contactParts.push(phone)
    if (location) contactParts.push(location)
    if (linkedin) contactParts.push(linkedin)
    if (website) contactParts.push(website)

    if (contactParts.length > 0) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: contactParts.join(' | '), marks: [{ type: 'italic' }] }]
      })
    }

    if (summary) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: summary }]
      })
    }

    content.push({ type: 'horizontalRule' })

    if (confirmedExperiences.length > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: isZH ? '工作经历' : 'Work Experience' }]
      })

        for (const exp of confirmedExperiences) {
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: [
            { type: 'text', text: exp.company },
            { type: 'text', text: ' | ' },
            { type: 'text', text: exp.job_title }
          ]
        })

        // Prefer original tenure format, fall back to parsed year format
        const tenureStr = exp.original_tenure
          ? exp.is_current
            ? exp.original_tenure.replace(/ - \S+$/, '') + (isZH ? ' - 至今' : ' - Present')
            : exp.original_tenure
          : (exp.start_date
            ? `${exp.start_date} – ${exp.is_current ? (isZH ? '至今' : 'Present') : (exp.end_date || '')}`
            : '')

        if (tenureStr) {
          content.push({
            type: 'paragraph',
            content: [
              { type: 'text', text: tenureStr, marks: [{ type: 'italic' }] }
            ]
          })
        }

        for (const a of exp.achievements) {
          const tierColor =
            a.tier === 1 ? '#22c55e' : a.tier === 2 ? '#eab308' : '#f87171'

          content.push({
            type: 'bulletListItem',
            attrs: { 'data-tier': a.tier, 'data-achievement-id': a.id },
            content: [
              {
                type: 'text',
                text: '● ',
                marks: [{ type: 'textStyle', attrs: { color: tierColor } }]
              },
              { type: 'text', text: a.text }
            ]
          })
        }
      }
    }

    if (resumeEducation.length > 0) {
      content.push({ type: 'horizontalRule' })
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: isZH ? '教育背景' : 'Education' }]
      })

      for (const edu of resumeEducation) {
        const eduText = edu.school + (edu.degree || edu.major ? ` | ${[edu.degree, edu.major].filter(Boolean).join(' · ')}` : '')
        const eduDate = edu.start_year ? ` | ${edu.start_year}${edu.end_year ? ` – ${edu.end_year}` : ''}` : ''

        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: eduText + eduDate }]
        })
      }
    }

    if (resumeSkills.length > 0) {
      content.push({ type: 'horizontalRule' })
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: isZH ? '技能与证书' : 'Skills & Certifications' }]
      })

      for (const group of resumeSkills) {
        content.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: group.category + ': ', marks: [{ type: 'bold' }] },
            { type: 'text', text: group.items.join(' · ') }
          ]
        })
      }
    }

    return { type: 'doc', content }
  }, [resumePersonalInfo, resumeEducation, resumeSkills, confirmedExperiences, isZH, resumeLang])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {
          keepMarks: true,
          keepAttributes: true
        }
      })
    ],
    content: buildInitialContent(),
    editable: true,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none',
        'data-resume-editor': 'true'
      },
      handleDOMEvents: {
        copy: (view, event) => {
          event.preventDefault()
          return true
        },
        cut: (view, event) => {
          event.preventDefault()
          return true
        },
        contextmenu: (view, event) => {
          event.preventDefault()
          return true
        },
        dragstart: (view, event) => {
          event.preventDefault()
          return true
        }
      }
    }
  })

  useEffect(() => {
    if (editor && !initialized) {
      const initialContent = buildInitialContent()
      editor.commands.setContent(initialContent)
      setInitialized(true)
    }
  }, [editor, buildInitialContent, initialized])

  useEffect(() => {
    if (editor && initialized) {
      const content = buildInitialContent()
      editor.commands.setContent(content)
    }
  }, [resumePersonalInfo, resumeEducation, resumeSkills, experiences, initialized, buildInitialContent, editor])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div
      ref={editorRef}
      className={cn(
        'bg-white p-8 md:p-12 min-h-[1123px] w-[794px] mx-auto shadow-lg relative',
        'select-none',
        'print:shadow-none print:w-full print:min-h-0',
        className
      )}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      <div className="print:hidden absolute top-2 right-2 flex items-center gap-2 z-10">
        <button
          onClick={handlePrint}
          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
          title="Print"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>
      </div>

      {showPhoto && (
        <div className="absolute top-8 right-8 w-20 h-24 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
          {photoPath ? (
            <img
              src={photoPath}
              alt="Profile"
              className="w-full h-full object-cover rounded"
              draggable={false}
            />
          ) : (
            <span className="text-xs text-gray-400 text-center px-1">
              {isZH ? '照片' : 'Photo'}
            </span>
          )}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="resume-editor-content"
      />

      <style jsx global>{`
        .resume-editor-content {
          outline: none;
        }
        .resume-editor-content .ProseMirror {
          outline: none;
          min-height: 900px;
        }
        .resume-editor-content .ProseMirror p {
          margin: 0.5em 0;
        }
        .resume-editor-content h1 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
        }
        .resume-editor-content h2 {
          font-size: 0.875rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.25rem;
        }
        .resume-editor-content h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.25rem;
        }
        .resume-editor-content ul {
          list-style: none;
          padding-left: 0;
        }
        .resume-editor-content li {
          margin: 0.25rem 0;
          padding-left: 1.25rem;
          position: relative;
        }
        .resume-editor-content li::before {
          content: '•';
          position: absolute;
          left: 0;
        }
        .resume-editor-content hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1rem 0;
        }
      `}</style>

      <div className="absolute bottom-4 right-4">
        <span className="text-xs text-gray-300">{isZH ? '内容受保护' : 'Protected'}</span>
      </div>
    </div>
  )
}
