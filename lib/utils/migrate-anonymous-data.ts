import { createClient } from '@/lib/supabase/server'

/**
 * migrateAnonymousData
 * Called after a user registers to transfer all anonymous-session data to their account.
 *
 * Migrates:
 *   - achievements
 *   - work_experiences
 *   - resume_versions
 *   - resume_uploads
 *   - payment_records
 *   - anonymous_payment_map (marks as migrated)
 *
 * IMPORTANT: Run as a DB transaction using multiple independent UPDATE statements.
 * Supabase JS client doesn't support multi-table transactions directly, so we
 * execute sequentially. If any step fails, subsequent steps are logged but not
 * rolled back (acceptable for MVP — data won't be lost, just not linked).
 */
export async function migrateAnonymousData(
  anonymousId: string,
  userId: string
): Promise<{ success: boolean; errors: string[] }> {
  if (!anonymousId || !userId) {
    return { success: false, errors: ['Missing anonymousId or userId'] }
  }

  const supabase = await createClient()
  const errors: string[] = []
  const migrationTime = new Date().toISOString()

  const tables: Array<{ table: string; column?: string }> = [
    { table: 'achievements' },
    { table: 'work_experiences' },
    { table: 'resume_versions' },
    { table: 'resume_uploads' },
    { table: 'payment_records' }
  ]

  for (const { table } of tables) {
    const { error } = await supabase
      .from(table)
      .update({ user_id: userId })
      .eq('anonymous_id', anonymousId)
      .is('user_id', null) // Only migrate rows not yet claimed by a user

    if (error) {
      errors.push(`${table}: ${error.message}`)
    }
  }

  // Mark payment map as migrated
  const { error: mapError } = await supabase
    .from('anonymous_payment_map')
    .update({
      status: 'migrated',
      migrated_at: migrationTime
    })
    .eq('anonymous_id', anonymousId)
    .eq('status', 'pending_migration')

  if (mapError) {
    errors.push(`anonymous_payment_map: ${mapError.message}`)
  }

  // Migrate subscriptions (linked by anonymous_id)
  const { error: subError } = await supabase
    .from('subscriptions')
    .update({ user_id: userId })
    .eq('anonymous_id', anonymousId)
    .is('user_id', null)

  if (subError) {
    errors.push(`subscriptions: ${subError.message}`)
  }

  return { success: errors.length === 0, errors }
}
