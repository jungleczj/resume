import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing anonymous_id or user_id' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const query = supabase
    .from('resume_uploads')
    .select('id, parse_status, parse_error, parsed_data, photo_extracted_path, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data, error } = userId
    ? await query.eq('user_id', userId)
    : await query.eq('anonymous_id', anonymousId!)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ status: 'not_found' })
  }

  return NextResponse.json({
    status: data[0].parse_status,
    error: data[0].parse_error,
    parsed_data: data[0].parsed_data ?? null,
    photo_extracted_path: data[0].photo_extracted_path ?? null
  })
}
