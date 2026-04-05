import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!anonymousId && !userId) {
    return NextResponse.json({ error: 'Missing anonymous_id or user_id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get most recent upload for this session
  const query = supabase
    .from('resume_uploads')
    .select('id, file_name, file_type, raw_text, parsed_info, parse_status, parse_error, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data, error } = userId
    ? await query.eq('user_id', userId)
    : await query.eq('anonymous_id', anonymousId!)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ data: null })
  }

  const upload = data[0]
  
  return NextResponse.json({ 
    data: {
      id: upload.id,
      fileName: upload.file_name,
      fileType: upload.file_type,
      rawText: upload.raw_text,
      parsedInfo: upload.parsed_info,
      parseStatus: upload.parse_status,
      parseError: upload.parse_error,
      createdAt: upload.created_at
    }
  })
}
