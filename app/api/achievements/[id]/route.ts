import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Missing achievement id' }, { status: 400 })
  }

  let body: { status?: string; text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { status, text } = body

  if (status !== undefined && !['confirmed', 'ignored', 'draft'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be one of: confirmed, ignored, draft' },
      { status: 400 }
    )
  }

  if (!status && text === undefined) {
    return NextResponse.json(
      { error: 'Must provide at least one of: status, text' },
      { status: 400 }
    )
  }

  // Use service client to bypass RLS — achievement may belong to anonymous session
  const supabase = createServiceClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (text !== undefined) updates.text = text

  const { data, error } = await supabase
    .from('achievements')
    .update(updates)
    .eq('id', id)
    .select('id, experience_id, text, status, tier, has_placeholders, ai_score, source, sort_order, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
