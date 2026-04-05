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
    <section className="h-[40%] p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          {t('workspace.jd_panel.title')}
        </h2>
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">
          AI Precision
        </span>
      </div>
      <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <textarea
          value={jdText}
          onChange={(e) => handleJdChange(e.target.value)}
          placeholder={t('workspace.jd_panel.placeholder')}
          className="w-full flex-1 p-4 text-sm bg-transparent border-none focus:ring-0 placeholder:text-slate-400 resize-none font-body leading-relaxed focus:outline-none"
        />
        <div className="p-4 bg-surface-container-high/50 flex justify-between items-center">
          <span className="text-[10px] text-on-surface-variant font-medium">
            Scanning for: Metrics, Keywords, Tech Stack
          </span>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2 bg-primary text-white rounded-full text-xs font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-sm">bolt</span>
            )}
            {t('workspace.jd_panel.generate_btn')}
          </button>
        </div>
      </div>
    </section>
  )
}
