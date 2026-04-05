import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const query = supabase
    .from('work_experiences')
    .select('*, achievements(*)')
    .order('sort_order', { ascending: true })

  const { data, error } = userId
    ? await query.eq('user_id', userId)
    : await query.eq('anonymous_id', anonymousId!)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
