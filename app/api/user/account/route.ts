/**
 * GDPR Account Deletion  (T-B3-4)
 *
 * DELETE /api/user/account
 *
 * Soft-deletes the authenticated user's profile by stamping `deleted_at`.
 * A scheduled job (Phase 2) should permanently purge rows where
 * deleted_at < NOW() - INTERVAL '7 days'.
 *
 * Uses the service client to bypass RLS so the update always succeeds
 * regardless of the user's own RLS policies.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Soft delete — stamp deleted_at; a background job handles hard deletion after 7 days
  const { error } = await service
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Invalidate the current session
  await supabase.auth.signOut()

  return NextResponse.json({
    message: '账号已注销，7天内数据将被永久删除',
  })
}
