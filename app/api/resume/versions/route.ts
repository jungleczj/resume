import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
  }

  const supabase = await createClient()

  const query = supabase
    .from('resume_versions')
    .select('id, snapshot_label, snapshot_jd, resume_lang, created_at, show_photo')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data, error } = userId
    ? await query.eq('user_id', userId)
    : await query.eq('anonymous_id', anonymousId!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
