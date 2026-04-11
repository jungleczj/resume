/**
 * GDPR Data Export  (T-B3-3)
 *
 * GET /api/user/export-data
 *
 * Returns a JSON bundle of all personal data for the authenticated user:
 *   - achievements
 *   - resume_versions (metadata only; editor_json blob excluded for size)
 *
 * Phase 2: replace with async email delivery + zip archive (jszip).
 * jszip is not currently installed; to enable zip delivery:
 *   npm install jszip
 * and update this route to compress the payload before sending.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [
    { data: achievements, error: achError },
    { data: versions, error: verError },
  ] = await Promise.all([
    supabase
      .from('achievements')
      .select('*')
      .eq('user_id', user.id),
    // Exclude editor_json: it can be megabytes and is not human-readable PII
    supabase
      .from('resume_versions')
      .select('id, snapshot_label, resume_lang, created_at, show_photo')
      .eq('user_id', user.id),
  ])

  if (achError) {
    return NextResponse.json({ error: achError.message }, { status: 500 })
  }
  if (verError) {
    return NextResponse.json({ error: verError.message }, { status: 500 })
  }

  return NextResponse.json({
    message: '数据导出成功',
    exported_at: new Date().toISOString(),
    user_id: user.id,
    data: {
      achievements: achievements ?? [],
      resume_versions: versions ?? [],
    },
  })
}
