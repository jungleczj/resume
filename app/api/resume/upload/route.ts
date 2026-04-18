import { NextRequest, NextResponse } from 'next/server'
import * as https from 'node:https'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { trackEvent } from '@/lib/analytics'
import { logError } from '@/lib/error-logger'
import { checkRateLimit } from '@/lib/rate-limit'

// Disable Next.js fetch deduplication/caching — binary storage uploads break with it
export const dynamic = 'force-dynamic'

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

/**
 * Upload a Buffer to Supabase Storage using Node.js's native https module.
 * This bypasses Next.js's patched globalThis.fetch (which breaks binary uploads
 * in the RSC bundle context on Windows/Node 18+ with undici).
 */
function uploadToStorageNative(
  filePath: string,
  buffer: Buffer,
  contentType: string,
  upsert = false,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const host = new URL(supabaseUrl).hostname

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: `/storage/v1/object/resumes/${filePath}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'x-upsert': upsert ? 'true' : 'false',
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve()
          } else {
            const msg = `Storage HTTP ${res.statusCode ?? 'no-status'}: ${body || '(empty body)'}`
            console.error('[upload:native] storage error detail:', msg)
            reject(new Error(msg))
          }
        })
      }
    )
    req.on('error', (err) => {
      console.error('[upload:native] network error:', err.message)
      reject(err)
    })
    req.write(buffer)
    req.end()
  })
}

/**
 * Upload via Supabase JS SDK — simpler path, used as fallback if native fails.
 * The SDK handles auth headers internally.
 */
async function uploadToStorageSDK(
  filePath: string,
  buffer: Buffer,
  contentType: string,
  upsert = false,
): Promise<void> {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()
  const { error } = await supabase.storage
    .from('resumes')
    .upload(filePath, buffer, { contentType, upsert })
  if (error) throw new Error(`SDK upload: ${error.message}`)
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
  // Rate limit: 10 uploads per IP per hour
  const rlKey = `upload:${req.headers.get('x-forwarded-for') ?? 'local'}`
  const { allowed, remaining, resetAt } = await checkRateLimit(rlKey, 10, 3600)
  if (!allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后重试' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetAt),
          'Retry-After': String(resetAt - Math.floor(Date.now() / 1000))
        }
      }
    )
  }
  void remaining // used in headers if needed; suppress unused-var warning

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

    // Strategy: try native node:https (2 attempts) then SDK fallback (1 attempt).
    // Native bypasses undici; SDK is simpler and used if native consistently fails.
    let storageError: Error | null = null
    let uploaded = false

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await uploadToStorageNative(filePath, fileBuffer, file.type, attempt > 1)
        uploaded = true
        break
      } catch (err) {
        storageError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[upload] native attempt ${attempt}/2 failed:`, storageError.message)
        if (attempt < 2) await new Promise(r => setTimeout(r, 600))
      }
    }

    if (!uploaded) {
      console.warn('[upload] native failed, trying SDK fallback')
      try {
        await uploadToStorageSDK(filePath, fileBuffer, file.type, true)
        uploaded = true
        storageError = null
      } catch (err) {
        storageError = err instanceof Error ? err : new Error(String(err))
        console.error('[upload] SDK fallback also failed:', storageError.message)
      }
    }

    if (!uploaded || storageError) {
      throw new Error(`Storage upload failed: ${storageError?.message ?? 'unknown'}`)
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    void fetch(`${appUrl}/api/resume/parse`, {
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
        anonymous_id: anonId,
        file_path: filePath,
        file_type: file.type
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
