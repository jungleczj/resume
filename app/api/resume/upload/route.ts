import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// PDF: %PDF (25 50 44 46)
// DOCX/DOC: PK zip header (50 4B) for OOXML, or D0 CF for legacy .doc
function isValidFileMagic(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // OOXML (.docx) is a ZIP archive
    return bytes[0] === 0x50 && bytes[1] === 0x4B
  }
  if (mimeType === 'application/msword') {
    // Legacy .doc is a Compound Document (OLE2): D0 CF 11 E0 A1 B1 1A E1
    return bytes[0] === 0xD0 && bytes[1] === 0xCF
  }
  return false
}

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

    // Magic-byte validation: verify actual file content matches declared type
    const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (!isValidFileMagic(headerBytes, file.type)) {
      return NextResponse.json({ error: 'File content does not match declared type.' }, { status: 400 })
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
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? ''
      },
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
