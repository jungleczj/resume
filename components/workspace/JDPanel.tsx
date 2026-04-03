'use client'

import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { trackEvent } from '@/lib/analytics'
import { Loader2 } from 'lucide-react'

const MAX_JD_LENGTH = 5000

export function JDPanel() {
  const t = useTranslations()
  const {
    jdText,
    setJdText,
    isGenerating,
    setIsGenerating,
    resumeLang,
    setEditorJson,
    anonymousId,
    userId
  } = useWorkspaceStore()

  const handleJdChange = (text: string) => {
    if (text.length > MAX_JD_LENGTH) return
    setJdText(text)
    if (text.length > 10) {
      trackEvent('jd_pasted', {
        anonymous_id: anonymousId,
        jd_length: text.length
      })
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)

    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jdText,
          anonymous_id: anonymousId,
          user_id: userId,
          resume_lang: resumeLang
        })
      })

      if (!res.ok) throw new Error('Generation failed')

      const { data } = await res.json()
      setEditorJson(data.editor_json)

      trackEvent('resume_generated', {
        anonymous_id: anonymousId,
        has_jd: jdText.length > 0,
        resume_lang: resumeLang
      })
    } catch {
      // Error handled by UI state
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: '40%' }}>
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {t('workspace.jd_panel.title')}
        </h3>
      </div>

      <div className="flex-1 relative">
        <textarea
          value={jdText}
          onChange={(e) => handleJdChange(e.target.value)}
          placeholder={t('workspace.jd_panel.placeholder')}
          className="w-full h-full resize-none px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
        />
      </div>

      <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {jdText.length}/{MAX_JD_LENGTH}
        </span>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
          {t('workspace.jd_panel.generate_btn')}
        </button>
      </div>
    </div>
  )
}
