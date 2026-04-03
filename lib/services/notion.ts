import { supabase } from '../supabase'
import { trackEvent } from '../analytics'

export async function connectNotion(userId: string, accessToken: string, workspaceId: string) {
  const { data } = await supabase
    .from('notion_connections')
    .insert({
      user_id: userId,
      access_token: accessToken,
      workspace_id: workspaceId,
      status: 'active'
    })
    .select()
    .single()

  await trackEvent('f2_notion_connected', { workspace_id: workspaceId })

  return data
}

export async function syncNotionAchievements(userId: string, connectionId: string) {
  // TODO: Implement Notion sync
  await trackEvent('f2_achievements_extracted', { task_count: 0 })
}
