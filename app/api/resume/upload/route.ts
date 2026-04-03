import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const anonymousId = formData.get('anonymous_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use PDF or Word.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const anonId = anonymousId ?? crypto.randomUUID()
    const supabase = await createClient()

    // Get authenticated user (optional — F1 works without login)
    const { data: { user } } = await supabase.auth.getUser()

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const filePath = `uploads/${anonId}/${crypto.randomUUID()}.${fileExt}`

    const { error: storageError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, { contentType: file.type })

    if (storageError) {
      throw new Error(`Storage error: ${storageError.message}`)
    }

    // Save upload metadata
    const { data: uploadRecord, error: dbError } = await supabase
      .from('resume_uploads')
      .insert({
        user_id: user?.id ?? null,
        anonymous_id: anonId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        parse_status: 'pending'
      })
      .select('id')
      .single()

    if (dbError) throw new Error(`DB error: ${dbError.message}`)

    // Trigger async parsing (fire-and-forget)
    void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/resume/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadRecord.id,
        file_path: filePath,
        anonymous_id: anonId,
        user_id: user?.id ?? null
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadRecord.id,
        anonymous_id: anonId
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
