/**
 * Anonymous File Cleanup Cron Job (T-B3-1)
 *
 * Triggered by Vercel Cron every hour.
 * Deletes expired anonymous uploads: resume_uploads rows where
 *   anonymous_id IS NOT NULL AND created_at < NOW() - 48h
 *
 * Vercel Cron config in vercel.json: { "path": "/api/cron/cleanup-anonymous", "schedule": "0 * * * *" }
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // Find expired anonymous upload rows
  const { data: expired, error: fetchErr } = await supabase
    .from('resume_uploads')
    .select('id, file_path, photo_extracted_path, anonymous_id')
    .not('anonymous_id', 'is', null)
    .lt('created_at', cutoff)

  if (fetchErr) {
    console.error('[cleanup-anonymous] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const ids = expired.map((r: { id: string }) => r.id)
  let storageDeleted = 0

  // Delete Storage files for expired uploads
  for (const row of expired as { id: string; file_path: string | null; photo_extracted_path: string | null; anonymous_id: string }[]) {
    if (row.file_path) {
      await supabase.storage.from('resumes').remove([row.file_path]).catch(() => {})
      storageDeleted++
    }
    if (row.photo_extracted_path) {
      await supabase.storage.from('photos').remove([row.photo_extracted_path]).catch(() => {})
      storageDeleted++
    }
  }

  // Delete DB rows
  const { error: deleteErr } = await supabase
    .from('resume_uploads')
    .delete()
    .in('id', ids)

  if (deleteErr) {
    console.error('[cleanup-anonymous] delete error:', deleteErr.message)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // Also cleanup anonymous work_experiences + achievements older than 48h
  const { error: expErr } = await supabase
    .from('work_experiences')
    .delete()
    .not('anonymous_id', 'is', null)
    .lt('created_at', cutoff)

  if (expErr) {
    console.error('[cleanup-anonymous] work_experiences delete error:', expErr.message)
  }

  console.log(`[cleanup-anonymous] deleted ${ids.length} uploads, ${storageDeleted} storage files`)
  return NextResponse.json({ ok: true, deleted: ids.length, storage_files: storageDeleted })
}
