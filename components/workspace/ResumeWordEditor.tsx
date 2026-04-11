'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { Loader2 } from 'lucide-react'

interface ResumeWordEditorProps {
  className?: string
  originalHtml: string | null | undefined
}

export function ResumeWordEditor({ className, originalHtml }: ResumeWordEditorProps) {
  console.log('[ResumeWordEditor] RENDER, originalHtml:', originalHtml ? `length=${originalHtml.length}` : 'null/undefined')
  
  const locale = useLocale()
  const isZH = locale === 'zh-CN'
  const editorRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  
  const { showPhoto, photoPath } = useWorkspaceStore()

  // Load original HTML into editor
  useEffect(() => {
    console.log('[ResumeWordEditor] Props received:', { 
      hasHtml: !!originalHtml, 
      htmlLength: originalHtml?.length,
      hasRef: !!editorRef.current,
      htmlPreview: originalHtml?.slice(0, 100)
    })
    
    if (originalHtml && editorRef.current) {
      console.log('[ResumeWordEditor] Setting innerHTML')
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = originalHtml
          console.log('[ResumeWordEditor] innerHTML set successfully, ref content length:', editorRef.current.innerHTML.length)
        }
      }, 50)
      setLoading(false)
      return () => clearTimeout(timer)
    } else {
      console.log('[ResumeWordEditor] No HTML to display')
      setLoading(false)
    }
  }, [originalHtml])

  // Prevent copy/paste/cut
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const preventCopy = (e: Event) => {
      e.preventDefault()
    }

    editor.addEventListener('copy', preventCopy)
    editor.addEventListener('cut', preventCopy)
    editor.addEventListener('contextmenu', preventCopy)

    return () => {
      editor.removeEventListener('copy', preventCopy)
      editor.removeEventListener('cut', preventCopy)
      editor.removeEventListener('contextmenu', preventCopy)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-500">{isZH ? '加载简历...' : 'Loading...'}</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full overflow-auto bg-gray-200 ${className || ''}`}>
      {/* DEBUG: show status */}
      <div className="bg-yellow-100 p-2 text-xs">
        Debug: originalHtml={!!originalHtml}, loading={loading}, ref={!!editorRef.current}
      </div>

      {/* Centered A4 Paper */}
      <div className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-auto">
        
        {/* A4 Paper */}
        <div 
          className="bg-white shadow-2xl relative"
          style={{
            width: '794px',
            minHeight: '1123px',
            border: '2px solid red' // DEBUG border
          }}
        >
          {/* Photo - positioned at top right */}
          {showPhoto && photoPath && (
            <div 
              className="absolute top-8 right-8 w-20 h-24 bg-gray-100 rounded border border-gray-300 flex items-center justify-center overflow-hidden z-10"
            >
              <img 
                src={photoPath} 
                alt="Profile" 
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          )}

          {/* Editable Word-like Area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="word-document"
            style={{
              width: '100%',
              minHeight: '1000px',
              padding: '48px',
              boxSizing: 'border-box',
              userSelect: 'text',
              WebkitUserSelect: 'text'
            }}
          />
        </div>
      </div>

      {/* Protection notice */}
      <div className="text-center py-2 text-xs text-gray-400 flex-shrink-0">
        {isZH ? '内容受保护，编辑请直接修改' : 'Protected - edit directly'}
      </div>

      {/* Preserve original DOCX styles */}
      <style jsx global>{`
        .word-document {
          caret-color: #333;
          font-size: 14px;
          line-height: 1.6;
        }
        .word-document:focus {
          outline: none;
        }
      `}</style>
    </div>
  )
}
