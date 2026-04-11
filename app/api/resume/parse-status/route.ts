import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/** True when PostgREST says a column/relation doesn't exist */
function isSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST204' || err.code === '42703') return true
  const msg = (err.message ?? '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing anonymous_id or user_id' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Attempt 1: full column set (including pii_detected if migration has been applied)
  // Attempt 2: minimal columns (fallback if pii_detected column doesn't exist yet)
  const selects = [
    'id, parse_status, parse_error, parsed_data, photo_extracted_path, pii_detected, created_at',
    'id, parse_status, parse_error, parsed_data, photo_extracted_path, created_at',
  ]

  let lastErr: { code?: string; message?: string } | null = null

  for (let i = 0; i < selects.length; i++) {
    try {
      const query = supabase
        .from('resume_uploads')
        .select(selects[i])
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = userId
        ? await query.eq('user_id', userId)
        : await query.eq('anonymous_id', anonymousId!)

      if (error) {
        lastErr = error
        console.error(`[parse-status] DB error (attempt ${i + 1}):`, error.code, error.message)
        // Schema error → retry with fewer columns
        if (isSchemaError(error) && i < selects.length - 1) continue
        // Non-schema error → return safe "pending" instead of 500 to avoid infinite poll loop
        return NextResponse.json({ status: 'pending' })
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ status: 'not_found' })
      }

      const row = data[0] as unknown as Record<string, unknown>
      return NextResponse.json({
        status: row.parse_status ?? 'pending',
        error: row.parse_error ?? null,
        parsed_data: row.parsed_data ?? null,
        photo_extracted_path: row.photo_extracted_path ?? null,
        pii_detected: row.pii_detected ?? false,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[parse-status] exception (attempt ${i + 1}):`, msg)
      lastErr = { message: msg }
      // On exception with more retries available, continue; otherwise return safe pending
      if (i >= selects.length - 1) {
        return NextResponse.json({ status: 'pending' })
      }
    }
  }

  // Should not reach here, but never return 500 — return pending to avoid poll storm
  console.error('[parse-status] all attempts failed:', lastErr?.message)
  return NextResponse.json({ status: 'pending' })
}
