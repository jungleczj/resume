import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { trackEvent } from '@/lib/analytics'
import { logError } from '@/lib/error-logger'

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
    return bytes[0] === 0x50 && bytes[1] === 0x4B
  }
  if (mimeType === 'application/msword') {
    return bytes[0] === 0xD0 && bytes[1] === 0xCF
  }
  return false
}

/** Serialize a full error chain (including .cause) to a loggable string */
function serializeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const parts: string[] = [`${err.name}: ${err.message}`]
  if (err.stack) parts.push(err.stack)
  // Node.js fetch TypeError wraps the real cause here
  const cause = (err as NodeJS.ErrnoException & { cause?: unknown }).cause
  if (cause) parts.push(`cause: ${serializeError(cause)}`)
  return parts.join('\n  ')
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

    // Read entire file into Buffer once — avoids Web API File/stream issues
    // with Node.js 18+ native fetch (undici) on Windows, and lets us reuse bytes
    const fileArrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(fileArrayBuffer)

    // Magic-byte validation
    const headerBytes = new Uint8Array(fileBuffer.subarray(0, 8))
    if (!isValidFileMagic(headerBytes, file.type)) {
      return NextResponse.json({ error: 'File content does not match declared type.' }, { status: 400 })
    }

    const anonId = anonymousId ?? crypto.randomUUID()
    const authClient = await createClient()
    const supabase = createServiceClient()

    // Get authenticated user (optional — F1 works without login)
    const { data: { user } } = await authClient.auth.getUser()

    // Upload Buffer (not File/Blob) to Supabase Storage
    // Using Buffer avoids the undici streaming bug on Windows
    const fileExt = file.name.split('.').pop()
    const filePath = `uploads/${anonId}/${crypto.randomUUID()}.${fileExt}`

    console.log('[upload] uploading to storage:', filePath, 'size:', fileBuffer.length)

    // Retry up to 3 times — Windows/Node.js 18+ native fetch (undici) can fail
    // on first attempt with ECONNRESET or TLS issues when reaching external HTTPS services
    let storageError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.storage
        .from('resumes')
        .upload(filePath, fileBuffer, { contentType: file.type, upsert: attempt > 1 })
      if (!error) { storageError = null; break }
      storageError = error as unknown as Error
      const detail = serializeError(error)
      console.warn(`[upload] storage attempt ${attempt}/3 failed:\n`, detail)
      if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt))
    }

    if (storageError) {
      const detail = serializeError(storageError)
      console.error('[upload] storage error full chain:\n', detail)
      throw new Error(`Storage error: ${(storageError as { message?: string }).message ?? storageError}`)
    }

    console.log('[upload] storage upload OK, inserting DB record')

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

    if (dbError) {
      console.error('[upload] DB insert error:', dbError.message, dbError.code)
      throw new Error(`DB error: ${dbError.message}`)
    }

    console.log('[upload] DB record created, id:', uploadRecord.id, '— firing parse job')

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

    await trackEvent('f1_upload_started', {
      anonymous_id: anonId,
      file_type: file.type,
      file_size: file.size
    })

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadRecord.id,
        anonymous_id: anonId
      }
    })
  } catch (error) {
    const detail = serializeError(error)
    console.error('[upload] ERROR:\n', detail)
    const message = error instanceof Error ? error.message : 'Upload failed'
    await logError({ context: 'upload', error, meta: { message } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
