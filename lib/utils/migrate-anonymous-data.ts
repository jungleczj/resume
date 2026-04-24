import { createServiceClient } from '@/lib/supabase/service'

/**
 * migrateAnonymousData
 * Called after a user authenticates to transfer all anonymous-session data
 * to their account.
 *
 * Uses the SERVICE ROLE client (bypasses RLS) because:
 *  - This runs inside /auth/callback where the new session cookie is written to
 *    the *response* object, not yet available in *request* cookies.
 *  - The anon-key client therefore has no authenticated session, so any RLS
 *    policy requiring auth.uid() silently rejects every UPDATE.
 *  - The caller (auth/callback) has already verified the user via
 *    exchangeCodeForSession + getUser(), so service-role usage is safe here.
 *
 * Migrates:
 *   - achievements
 *   - work_experiences
 *   - resume_versions
 *   - resume_uploads
 *   - payment_records
 *   - subscriptions
 *   - anonymous_payment_map (marks as migrated)
 */
export async function migrateAnonymousData(
  anonymousId: string,
  userId: string,
): Promise<{ success: boolean; errors: string[] }> {
  if (!anonymousId || !userId) {
    return { success: false, errors: ['Missing anonymousId or userId'] }
  }

  // Service client bypasses RLS — safe because caller has already authenticated the user.
  const supabase = createServiceClient()
  const errors: string[] = []
  const migrationTime = new Date().toISOString()

  const tables = [
    'achievements',
    'work_experiences',
    'resume_versions',
    'resume_uploads',
    'payment_records',
  ] as const

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .update({ user_id: userId })
      .eq('anonymous_id', anonymousId)
      .is('user_id', null) // Only claim rows not yet linked to any user

    if (error) {
      errors.push(`${table}: ${error.message}`)
      console.error(`[migrate] ${table}:`, error.message)
    }
  }

  // Mark payment map as migrated
  const { error: mapError } = await supabase
    .from('anonymous_payment_map')
    .update({ status: 'migrated', migrated_at: migrationTime })
    .eq('anonymous_id', anonymousId)
    .eq('status', 'pending_migration')

  if (mapError) {
    errors.push(`anonymous_payment_map: ${mapError.message}`)
    console.error('[migrate] anonymous_payment_map:', mapError.message)
  }

  // Migrate subscriptions
  const { error: subError } = await supabase
    .from('subscriptions')
    .update({ user_id: userId })
    .eq('anonymous_id', anonymousId)
    .is('user_id', null)

  if (subError) {
    errors.push(`subscriptions: ${subError.message}`)
    console.error('[migrate] subscriptions:', subError.message)
  }

  if (errors.length === 0) {
    console.log(`[migrate] anonymous_id=${anonymousId} → user_id=${userId} OK`)
  } else {
    console.warn(`[migrate] completed with ${errors.length} error(s)`)
  }

  return { success: errors.length === 0, errors }
}
