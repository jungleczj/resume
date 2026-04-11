'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface OriginalResumeViewerProps {
  filePath: string | null
  fileType: string | null  // 'pdf' | 'docx' | 'doc'
  anonymousId: string
  userId: string | null
}

type ViewerState = 'idle' | 'loading' | 'ready' | 'error'

export function OriginalResumeViewer({
  filePath,
  fileType,
  anonymousId,
  userId
}: OriginalResumeViewerProps) {
  const [state, setState] = useState<ViewerState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const docxContainerRef = useRef<HTMLDivElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!filePath || !fileType) return

    const ext = fileType.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx' && ext !== 'doc') return

    const load = async () => {
      setState('loading')
      setErrorMsg(null)

      try {
        const params = new URLSearchParams({ file_path: filePath })
        if (userId) params.set('user_id', userId)
        else params.set('anonymous_id', anonymousId)

        const res = await fetch(`/api/resume/raw?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const arrayBuffer = await res.arrayBuffer()
        if (!mountedRef.current) return

        if (ext === 'pdf') {
          await renderPDF(arrayBuffer)
        } else {
          await renderDOCX(arrayBuffer)
        }

        if (mountedRef.current) setState('ready')
      } catch (err) {
        if (!mountedRef.current) return
        console.error('[OriginalResumeViewer] render error:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load')
        setState('error')
      }
    }

    const renderPDF = async (buffer: ArrayBuffer) => {
      const container = pdfContainerRef.current
      if (!container) return

      // Dynamic import to avoid SSR issues and keep initial bundle small
      const pdfjsLib = await import('pdfjs-dist')

      // Use CDN worker — avoids webpack worker config complexity
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
      if (!mountedRef.current) return

      // Clear previous render
      container.innerHTML = ''

      const SCALE = 1.5

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (!mountedRef.current) break

        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: SCALE })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.display = 'block'
        canvas.style.width = '100%'
        canvas.style.marginBottom = '8px'
        canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'

        await page.render({ canvas, viewport }).promise

        if (!mountedRef.current) break
        container.appendChild(canvas)
      }

      // No text layer = canvas only = pixels, nothing to select/copy
    }

    const renderDOCX = async (buffer: ArrayBuffer) => {
      const container = docxContainerRef.current
      if (!container) return

      const { renderAsync } = await import('docx-preview')
      if (!mountedRef.current) return

      container.innerHTML = ''

      await renderAsync(buffer, container, undefined, {
        className: 'docx-preview-root',
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true
      })
    }

    load()
  }, [filePath, fileType, anonymousId, userId])

  if (!filePath || !fileType) return null

  const ext = fileType.toLowerCase()

  return (
    <div
      className="relative w-full h-full"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      {/* Loading overlay */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading resume...</span>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-center">
            <span className="material-symbols-outlined text-red-400 text-4xl block mb-2">
              error_outline
            </span>
            <p className="text-sm text-gray-500">{errorMsg ?? 'Failed to render resume'}</p>
          </div>
        </div>
      )}

      {/* PDF canvas container */}
      {(ext === 'pdf') && (
        <div
          ref={pdfContainerRef}
          className="w-full p-4 bg-gray-100 min-h-full"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* DOCX rendered container */}
      {(ext === 'docx' || ext === 'doc') && (
        <>
          <div
            ref={docxContainerRef}
            className="w-full bg-gray-100 min-h-full p-4"
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Transparent copy-protection overlay over DOCX HTML */}
          <div
            className="absolute inset-0 z-20"
            style={{ pointerEvents: state === 'ready' ? 'auto' : 'none' }}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          />
        </>
      )}

      <style jsx global>{`
        .docx-preview-root {
          user-select: none !important;
          -webkit-user-select: none !important;
          pointer-events: none;
        }
        .docx-preview-root * {
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        /* docx-preview page styling */
        .docx-preview-root section {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          margin: 0 auto 16px auto;
        }
      `}</style>
    </div>
  )
}
