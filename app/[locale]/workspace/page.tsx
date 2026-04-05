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

  // Load latest upload status + parsed data (personal info, education, skills, photo)
  let initialParseStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending'
  let initialParsedData: {
    personal_info: Record<string, unknown> | null
    education: unknown[]
    skills: unknown[]
  } | null = null
  let initialPhotoPath: string | null = null

  const uploadQuery = supabase
    .from('resume_uploads')
    .select('parse_status, parsed_data, photo_extracted_path')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: uploadRows } = user
    ? await uploadQuery.eq('user_id', user.id)
    : await uploadQuery.eq('anonymous_id', anonymous_id!)

  if (uploadRows?.[0]) {
    const row = uploadRows[0]
    initialParseStatus = (row.parse_status as typeof initialParseStatus) ?? 'pending'
    if (row.parse_status === 'completed' && row.parsed_data) {
      initialParsedData = row.parsed_data as typeof initialParsedData
    }
    if (row.photo_extracted_path) {
      initialPhotoPath = row.photo_extracted_path
    }
  }

  return (
    <WorkspaceClient
      experiences={experiences ?? []}
      anonymousId={anonymous_id!}
      userId={user?.id ?? null}
      profile={profile}
      locale={locale}
      initialParseStatus={initialParseStatus}
      initialParsedData={initialParsedData}
      initialPhotoPath={initialPhotoPath}
    />
  )
}
