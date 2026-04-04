import { supabase } from '../supabase'
import { callAI } from '../ai-router'
import { getPrompt } from '../prompts'
import { trackEvent } from '../analytics'

export async function parseResume(
  uploadId: string,
  context: { userId?: string; anonymousId: string; market: 'cn' | 'en' }
) {
  const startTime = Date.now()

  const { data: upload } = await supabase
    .from('resume_uploads')
    .select('*')
    .eq('id', uploadId)
    .single()

  if (!upload) throw new Error('Upload not found')

  const rawText = await parseFile(upload.file_path)
  const prompt = await getPrompt('resume_beautify', context.market)

  const beautifiedRaw = await callAI('resume_beautify', [
    { role: 'system', content: prompt },
    { role: 'user', content: rawText }
  ], context.market)

  const beautified = JSON.parse(beautifiedRaw) as {
    items: Array<{ tier: number; text: string; [key: string]: unknown }>
    tiptap_json: unknown
  }

  await saveAchievements(beautified.items, context)

  const { data: version } = await supabase
    .from('resume_versions')
    .insert({
      user_id: context.userId,
      anonymous_id: context.userId ? null : context.anonymousId,
      upload_id: uploadId,
      editor_json: beautified.tiptap_json,
      photo_path: upload.photo_extracted,
      show_photo: context.market === 'cn',
      template_key: 'default'
    })
    .select()
    .single()

  await trackEvent('f1_parse_completed', {
    upload_id: uploadId,
    parse_duration_ms: Date.now() - startTime,
    tier1_count: beautified.items.filter((i: any) => i.tier === 1).length,
    tier2_count: beautified.items.filter((i: any) => i.tier === 2).length,
    tier3_count: beautified.items.filter((i: any) => i.tier === 3).length
  })

  return version
}

async function parseFile(filePath: string): Promise<string> {
  // TODO: Implement file parsing
  return ''
}

async function saveAchievements(items: any[], context: any) {
  // TODO: Implement achievement saving
}
