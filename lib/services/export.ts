import { supabase } from '../supabase'
import { trackEvent } from '../analytics'
import { generatePDF } from '../utils/pdf-generator'
import { generateDOCX } from '../utils/docx-generator'

export async function exportResume(
  versionId: string,
  format: 'pdf' | 'docx',
  context: { userId?: string; anonymousId: string }
) {
  const { data: version } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (!version) throw new Error('Version not found')

  // Load experiences with achievements
  const query = supabase
    .from('work_experiences')
    .select('*, achievements(*)')
    .order('sort_order', { ascending: true })

  const { data: experiences } = context.userId
    ? await query.eq('user_id', context.userId)
    : await query.eq('anonymous_id', context.anonymousId)

  const blob = format === 'pdf'
    ? await generatePDF({
        name: '张伟',
        contact: { email: 'example@email.com', phone: '+86 138 0000 0000' },
        experiences: experiences || [],
        showPhoto: version.show_photo,
        lang: version.template_key === 'en' ? 'en' : 'zh'
      })
    : await generateDOCX({
        name: '张伟',
        contact: { email: 'example@email.com', phone: '+86 138 0000 0000' },
        experiences: experiences || [],
        lang: version.template_key === 'en' ? 'en' : 'zh'
      })

  await trackEvent('export_completed', {
    format,
    has_photo: version.show_photo,
    resume_lang: version.template_key
  })

  return { blob, filename: `resume.${format}` }
}
