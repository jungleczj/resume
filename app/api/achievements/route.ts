import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// Full column set — requires migrations 20260407 and 20260409 to be applied
const FULL_SELECT = `
  id, text, status, tier, has_placeholders, ai_score, source,
  project_name, project_member_role, original_text, is_featured,
  created_at, updated_at,
  experience_id,
  work_experiences!inner(company, job_title, start_date, end_date, is_current, original_tenure)
`

// Core columns — always present since initial migration (safe fallback)
const CORE_SELECT = `
  id, text, status, tier, has_placeholders, ai_score, source,
  created_at, updated_at,
  experience_id,
  work_experiences!inner(company, job_title, start_date, end_date, is_current, original_tenure)
`

function isSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST204' || err.code === '42703') return true
  const msg = err.message?.toLowerCase() ?? ''
  return msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const status = searchParams.get('status') // optional filter: draft|confirmed|ignored
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

  // Try authenticated user first
  const authClient = await createClient()
  let userId: string | null = null
  try {
    const { data: { user } } = await authClient.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Network error (e.g. Supabase paused) — proceed with anonymous path
  }

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { error: 'Not authenticated. Please sign in again.' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const buildQuery = (select: string) => {
    const q = supabase
      .from('achievements')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(limit)
    const filtered = status ? q.eq('status', status) : q
    return userId
      ? filtered.eq('user_id', userId)
      : filtered.eq('anonymous_id', anonymousId!)
  }

  // Try full column set first; fall back to core columns if migrations not yet applied
  let { data, error } = await buildQuery(FULL_SELECT)

  if (error && isSchemaError(error)) {
    console.warn('[GET /api/achievements] schema fallback — missing columns, run pending migrations:', error.message)
    ;({ data, error } = await buildQuery(CORE_SELECT))
  }

  if (error) {
    console.error('[GET /api/achievements]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
