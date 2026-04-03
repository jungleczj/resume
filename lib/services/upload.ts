import { supabase } from '../supabase'
import { trackEvent } from '../analytics'

export async function uploadResume(
  file: File,
  context: { userId?: string; anonymousId: string }
) {
  const { userId, anonymousId } = context
  const filePath = `uploads/${anonymousId}/${crypto.randomUUID()}/${file.name}`

  const { data, error } = await supabase.storage
    .from('resumes')
    .upload(filePath, file)

  if (error) throw error

  const { data: meta } = await supabase
    .from('resume_uploads')
    .insert({
      user_id: userId,
      anonymous_id: userId ? null : anonymousId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size
    })
    .select()
    .single()

  await trackEvent('f1_upload_started', {
    file_type: file.type,
    file_size: file.size,
    has_user: !!userId
  })

  return meta
}
