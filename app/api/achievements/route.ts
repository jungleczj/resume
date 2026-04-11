import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

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
    // ECONNRESET — proceed with anonymous path
  }

  if (!userId && !anonymousId) {
    return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const query = supabase
    .from('achievements')
    .select(`
      id, text, status, tier, has_placeholders, ai_score, source,
      project_name, project_member_role, original_text, is_featured,
      created_at, updated_at,
      experience_id,
      work_experiences!inner(company, job_title, start_date, end_date, is_current, original_tenure)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Add status filter if provided
  const filteredQuery = status ? query.eq('status', status) : query

  const { data, error } = userId
    ? await filteredQuery.eq('user_id', userId)
    : await filteredQuery.eq('anonymous_id', anonymousId!)

  if (error) {
    console.error('[GET /api/achievements]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
