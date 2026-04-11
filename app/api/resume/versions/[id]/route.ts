import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { snapshot_label?: string }
    const { snapshot_label } = body

    if (!snapshot_label?.trim()) {
      return NextResponse.json({ error: 'Missing snapshot_label' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('resume_versions')
      .update({ snapshot_label: snapshot_label.trim() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
