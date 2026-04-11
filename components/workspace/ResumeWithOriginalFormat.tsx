'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useWorkspaceStore } from '@/store/workspace'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ResumeWithOriginalFormatProps {
  className?: string
}

interface OriginalResumeData {
  filePath: string
  fileType: string
  htmlContent?: string
  experiences: Array<{
    id: string
    company: string
    jobTitle: string
    originalTenure: string | null
    startYear: number | null
    endYear: number | null
    isCurrent: boolean
    achievements: Array<{
      id: string
      text: string
      tier: number
      status: string
    }>
  }>
}

export function ResumeWithOriginalFormat({ className }: ResumeWithOriginalFormatProps) {
  const locale = useLocale()
  const isZH = locale === 'zh-CN'
  const [loading, setLoading] = useState(false)
  const [originalHTML, setOriginalHTML] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const editorRef = useRef<HTMLDivElement>(null)

  const {
    resumePersonalInfo,
    resumeEducation,
    resumeSkills,
    experiences,
    showPhoto,
    photoPath,
    resumeLang
  } = useWorkspaceStore()

  // Load original resume if available
  useEffect(() => {
    const loadOriginalResume = async () => {
      // Check if we have an uploaded resume file
      const lastUpload = localStorage.getItem('cf_last_upload')
      if (!lastUpload) return

      try {
        const uploadData = JSON.parse(lastUpload)
        if (!uploadData.filePath) return

        setLoading(true)
        const response = await fetch(`/api/resume/raw?file_path=${encodeURIComponent(uploadData.filePath)}`)
        if (response.ok) {
          const { html } = await response.json()
          setOriginalHTML(html)
        }
      } catch (err) {
        console.error('Failed to load original resume:', err)
      } finally {
        setLoading(false)
      }
    }

    loadOriginalResume()
  }, [])

  const confirmedExperiences = experiences.map((exp) => ({
    ...exp,
    achievements: (exp.achievements ?? []).filter((a) => a.status === 'confirmed')
  }))

  // Build achievement highlight markers
  const buildAchievementMarkers = useCallback(() => {
    return confirmedExperiences.map(exp => ({
      company: exp.company,
      jobTitle: exp.job_title,
      tenure: exp.original_tenure || (exp.start_date
        ? `${exp.start_date} – ${exp.is_current ? (isZH ? '至今' : 'Present') : (exp.end_date || '')}`
        : ''),
      achievements: exp.achievements.map(a => ({
        id: a.id,
        text: a.text,
        tier: a.tier,
        tierColor: a.tier === 1 ? '#22c55e' : a.tier === 2 ? '#eab308' : '#f87171'
      }))
    }))
  }, [confirmedExperiences, isZH])

  // Build editor content from experiences (for editing)
  const buildEditorContent = useCallback(() => {
    const markers = buildAchievementMarkers()
    
    const content: Record<string, unknown>[] = []

    // Personal Info
    if (resumePersonalInfo?.name) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: resumePersonalInfo.name, marks: [{ type: 'bold' }] }]
      })
      
      const contacts: string[] = []
      if (resumePersonalInfo.email) contacts.push(resumePersonalInfo.email)
      if (resumePersonalInfo.phone) contacts.push(resumePersonalInfo.phone)
      if (resumePersonalInfo.location) contacts.push(resumePersonalInfo.location)
      if (contacts.length > 0) {
        content.push({ type: 'paragraph', content: [{ type: 'text', text: contacts.join(' | ') }] })
      }
    }

    // Experiences with achievements
    for (const marker of markers) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: `${marker.company} | ${marker.jobTitle}`, marks: [{ type: 'bold' }] }
        ]
      })
      if (marker.tenure) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: marker.tenure, marks: [{ type: 'italic' }] }]
        })
      }
      
      for (const ach of marker.achievements) {
        content.push({
          type: 'bulletListItem',
          attrs: { 'data-achievement-id': ach.id, 'data-tier': ach.tier },
          content: [
            {
              type: 'text',
              text: `● ${ach.text}`,
              marks: [{ type: 'textStyle', attrs: { color: ach.tierColor } }]
            }
          ]
        })
      }
    }

    return { type: 'doc', content }
  }, [resumePersonalInfo, buildAchievementMarkers])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: true
        }
      })
    ],
    content: buildEditorContent(),
    editable: true,
    editorProps: {
      attributes: {
        class: 'original-resume-editor',
        'data-editing': 'achievements'
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
        }
      }
    }
  })

  useEffect(() => {
    if (editor) {
      const newContent = buildEditorContent()
      editor.commands.setContent(newContent)
    }
  }, [editor, buildEditorContent])

  // Tier legend
  const tierLegend = [
    { tier: 1, label: isZH ? '量化成就' : 'Quantified', color: '#22c55e' },
    { tier: 2, label: isZH ? '待补充' : 'To Fill', color: '#eab308' },
    { tier: 3, label: isZH ? '经验描述' : 'Experience', color: '#f87171' }
  ]

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[600px]', className)}>
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Tier Legend */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-xs text-gray-500">{isZH ? '成就等级：' : 'Achievement Tiers:'}</span>
        {tierLegend.map(t => (
          <div key={t.tier} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-xs text-gray-600">{t.label}</span>
          </div>
        ))}
      </div>

      <div
        ref={editorRef}
        className={cn(
          'bg-white shadow-lg min-h-[1123px] w-[794px] mx-auto p-12 relative',
          'select-none',
          'print:shadow-none print:w-full print:min-h-0'
        )}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        {/* Photo */}
        {showPhoto && (
          <div className="absolute top-12 right-12 w-20 h-24 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
            {photoPath ? (
              <img src={photoPath} alt="Profile" className="w-full h-full object-cover rounded" draggable={false} />
            ) : (
              <span className="text-xs text-gray-400 text-center px-1">{isZH ? '照片' : 'Photo'}</span>
            )}
          </div>
        )}

        {/* Original Resume Content (if available) or Editor */}
        {originalHTML ? (
          <div
            className="original-content"
            dangerouslySetInnerHTML={{ __html: originalHTML }}
          />
        ) : (
          <EditorContent
            editor={editor}
            className="original-resume-editor"
          />
        )}

        {/* Protection notice */}
        <div className="absolute bottom-4 right-4">
          <span className="text-xs text-gray-300">
            {isZH ? '内容受保护' : 'Protected'}
          </span>
        </div>
      </div>

      <style jsx global>{`
        .original-resume-editor {
          outline: none;
        }
        .original-resume-editor .ProseMirror {
          outline: none;
          min-height: 900px;
          font-family: 'Times New Roman', serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #333;
        }
        .original-resume-editor h1 {
          font-size: 16pt;
          font-weight: bold;
          margin-bottom: 6pt;
        }
        .original-resume-editor h2 {
          font-size: 14pt;
          font-weight: bold;
          margin-top: 12pt;
          margin-bottom: 6pt;
          text-transform: uppercase;
          letter-spacing: 1pt;
          border-bottom: 1px solid #ccc;
          padding-bottom: 3pt;
        }
        .original-resume-editor h3 {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 10pt;
          margin-bottom: 4pt;
        }
        .original-resume-editor p {
          margin: 4pt 0;
        }
        .original-resume-editor ul {
          list-style-type: disc;
          padding-left: 18pt;
          margin: 4pt 0;
        }
        .original-resume-editor li {
          margin: 2pt 0;
        }

        /* Original DOCX styles preservation */
        .original-content {
          font-family: 'Times New Roman', 'Arial', sans-serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        .original-content p {
          margin: 6pt 0;
        }
        .original-content h1 {
          font-size: 18pt;
          font-weight: bold;
          margin: 12pt 0 6pt 0;
        }
        .original-content h2 {
          font-size: 14pt;
          font-weight: bold;
          margin: 10pt 0 6pt 0;
          text-transform: uppercase;
          border-bottom: 1px solid #999;
          padding-bottom: 4pt;
        }
        .original-content h3 {
          font-size: 12pt;
          font-weight: bold;
          margin: 8pt 0 4pt 0;
        }
        .original-content ul, .original-content ol {
          margin: 4pt 0;
          padding-left: 18pt;
        }
        .original-content li {
          margin: 3pt 0;
        }
      `}</style>
    </div>
  )
}
