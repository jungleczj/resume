import { createClient } from '@/lib/supabase/server'

interface ErrorLogOptions {
  context: string
  error: unknown
  anonymousId?: string | null
  userId?: string | null
  uploadId?: string | null
  meta?: Record<string, unknown>
}

export async function logError(opts: ErrorLogOptions): Promise<void> {
  const { context, error, anonymousId, userId, uploadId, meta } = opts
  const errorMsg = error instanceof Error ? error.message : String(error)
  const stack    = error instanceof Error ? error.stack ?? null : null

  try {
    const supabase = await createClient()
    await supabase.from('error_logs').insert({
      context,
      error_msg: errorMsg,
      stack,
      anonymous_id: anonymousId ?? null,
      user_id: userId ?? null,
      upload_id: uploadId ?? null,
      meta: meta ?? {}
    })
  } catch {
    // Never throw from error logger — just silently fail
    console.error('[error-logger] Failed to persist error log:', errorMsg)
  }
}
