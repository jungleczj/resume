import { createClient } from '@/lib/supabase/server'
import { WorkspaceClient } from '@/components/workspace/WorkspaceClient'
import { redirect } from '@/lib/i18n/navigation'

interface WorkspacePageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ anonymous_id?: string }>
}

export default async function WorkspacePage({
  params,
  searchParams
}: WorkspacePageProps) {
  const { locale } = await params
  const { anonymous_id } = await searchParams

  if (!anonymous_id) {
    redirect({ href: '/', locale })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Load work experiences + achievements
  const query = supabase
    .from('work_experiences')
    .select(`
      *,
      achievements (*)
    `)
    .order('sort_order', { ascending: true })

  const { data: experiences } = user
    ? await query.eq('user_id', user.id)
    : await query.eq('anonymous_id', anonymous_id!)

  // Load user profile (if authenticated)
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <WorkspaceClient
      experiences={experiences ?? []}
      anonymousId={anonymous_id!}
      userId={user?.id ?? null}
      profile={profile}
      locale={locale}
    />
  )
}
