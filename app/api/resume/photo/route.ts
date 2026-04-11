import { NextRequest, NextResponse } from 'next/server'
import * as https from 'node:https'
import { createServiceClient } from '@/lib/supabase/service'
import { trackEvent } from '@/lib/analytics'

// Disable Next.js fetch deduplication/caching — binary storage uploads break with it
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Upload a Buffer to Supabase Storage using Node.js's native https module.
 * Bypasses Next.js's patched globalThis.fetch which breaks binary uploads.
 */
function uploadPhotoNative(
  filePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const host = new URL(supabaseUrl).hostname

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: `/storage/v1/object/photos/${filePath}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'x-upsert': 'true',
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
            reject(new Error(`Storage ${res.statusCode}: ${body}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }

  const anonymousId = form.get('anonymous_id') as string | null
  const userId = form.get('user_id') as string | null

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing anonymous_id or user_id' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const folder = userId ?? `anon_${anonymousId}`
  const uuid = crypto.randomUUID()
  const fileName = `${folder}/${uuid}/photo.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Retry up to 3 times — same pattern as upload/route.ts
  let storageError: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await uploadPhotoNative(fileName, buffer, file.type)
      storageError = null
      break
    } catch (err) {
      storageError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[photo] storage attempt ${attempt}/3 failed:`, storageError.message)
      if (attempt < 3) await new Promise(r => setTimeout(r, 600 * attempt))
    }
  }

  if (storageError) {
    console.error('[photo] storage error after 3 attempts:', storageError.message)
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 })
  }

  const supabase = createServiceClient()

  // Use signed URL (10yr) — works regardless of bucket visibility
  const { data: signed } = await supabase.storage
    .from('photos')
    .createSignedUrl(fileName, 315360000)
  const publicUrl = signed?.signedUrl
    ?? supabase.storage.from('photos').getPublicUrl(fileName).data.publicUrl

  // Persist photo path to profiles (authenticated users)
  if (userId) {
    await supabase
      .from('profiles')
      .update({ photo_path: fileName })
      .eq('id', userId)
  }

  void trackEvent('photo_uploaded', {
    anonymous_id: anonymousId ?? undefined,
    user_id: userId ?? undefined,
    source: 'manual',
    market: userId ? 'en_paid' : 'cn_free',
  })

  return NextResponse.json({ url: publicUrl, path: fileName })
}
