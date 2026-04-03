'use client'

import { useTranslations } from 'next-intl'
import { useWorkspaceStore } from '@/store/workspace'
import { trackEvent } from '@/lib/analytics'
import {
  FileText,
  Download,
  History,
  ChevronDown,
  Camera,
  Save,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/domain'

interface WorkspaceToolbarProps {
  anonymousId: string
  userId: string | null
  profile: Profile | null
}

export function WorkspaceToolbar({
  anonymousId,
  userId,
  profile
}: WorkspaceToolbarProps) {
  const t = useTranslations()
  const {
    resumeLang,
    setResumeLang,
    showPhoto,
    togglePhoto,
    isGenerating,
    jdText,
    editorJson,
    setIsGenerating
  } = useWorkspaceStore()

  const handleGenerate = async () => {
    setIsGenerating(true)
    await trackEvent('resume_generated', {
      anonymous_id: anonymousId,
      has_jd: jdText.length > 0,
      resume_lang: resumeLang
    })
    // Generation logic handled in JDPanel
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    await trackEvent('export_clicked', {
      anonymous_id: anonymousId,
      format,
      has_jd: jdText.length > 0,
      has_photo: showPhoto,
      resume_lang: resumeLang
    })

    // Paywall check for EN market
    if (profile?.payment_market === 'en_paid') {
      // Trigger paywall modal (handled by parent)
      window.dispatchEvent(new CustomEvent('cf:paywall', { detail: { format } }))
      return
    }

    // CN free: direct export
    window.dispatchEvent(new CustomEvent('cf:export', { detail: { format } }))
  }

  const handlePhotoToggle = () => {
    togglePhoto()
    trackEvent('photo_toggled', {
      anonymous_id: anonymousId,
      state: !showPhoto ? 'on' : 'off',
      has_photo: !!profile?.photo_path
    })
  }

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shadow-sm z-10">
      {/* Logo */}
      <span className="font-display font-bold text-gray-900 mr-2">
        CareerFlow
      </span>

      <div className="w-px h-5 bg-gray-200" />

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors',
          isGenerating && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        {t('workspace.toolbar.generate')}
      </button>

      {/* Export dropdown */}
      <div className="relative group">
        <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" />
          {t('workspace.toolbar.export')}
          <ChevronDown className="w-3 h-3" />
        </button>
        <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <button
            onClick={() => handleExport('pdf')}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
          >
            {t('export.formats.pdf')}
          </button>
          <button
            onClick={() => handleExport('docx')}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
          >
            {t('export.formats.docx')}
          </button>
        </div>
      </div>

      {/* History */}
      <button className="flex items-center gap-1 px-2 py-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
        <History className="w-3.5 h-3.5" />
        <span className="hidden md:block">{t('workspace.toolbar.history')}</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Language toggle */}
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
        <button
          onClick={() => setResumeLang('zh')}
          className={cn(
            'px-2.5 py-1.5 font-medium transition-colors',
            resumeLang === 'zh'
              ? 'bg-brand text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          中文
        </button>
        <button
          onClick={() => setResumeLang('en')}
          className={cn(
            'px-2.5 py-1.5 font-medium transition-colors',
            resumeLang === 'en'
              ? 'bg-brand text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          EN
        </button>
      </div>

      {/* Photo toggle */}
      <button
        onClick={handlePhotoToggle}
        title={t('workspace.toolbar.photo')}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 text-sm rounded-lg transition-colors',
          showPhoto
            ? 'bg-brand-50 text-brand'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        <Camera className="w-3.5 h-3.5" />
        <span className="hidden md:block text-xs">{t('workspace.toolbar.photo')}</span>
      </button>

      {/* Save */}
      <button className="flex items-center gap-1 px-2 py-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
        <Save className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
