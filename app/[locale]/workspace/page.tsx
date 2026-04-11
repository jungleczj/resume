import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

  console.log('[workspace:page] === START ===')
  console.log('[workspace:page] anonymous_id:', anonymous_id)
  console.log('[workspace:page] locale:', locale)

  if (!anonymous_id) {
    console.log('[workspace:page] No anonymous_id, redirecting')
    redirect({ href: '/', locale })
  }

  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[workspace:page] user:', user ? user.id : 'null')

  // Load work experiences + achievements (use service client to bypass RLS for anonymous users)
  const expQuery = supabaseAdmin
    .from('work_experiences')
    .select(`
      *,
      achievements (*)
    `)
    .order('sort_order', { ascending: true })

  const { data: experiences } = user
    ? await expQuery.eq('user_id', user.id)
    : await expQuery.eq('anonymous_id', anonymous_id!)
  console.log('[workspace:page] experiences count:', experiences?.length ?? 0)

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
  let uploadFilePath: string | null = null
  let uploadFileType: string | null = null
  let uploadId: string | null = null

  // Use service client for uploads so anonymous users (no auth session) can read their own rows
  const uploadQuery = supabaseAdmin
    .from('resume_uploads')
    .select('id, parse_status, parsed_data, photo_extracted_path, file_path, file_type')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: uploadRows, error: uploadRowsError } = user
    ? await uploadQuery.eq('user_id', user.id)
    : await uploadQuery.eq('anonymous_id', anonymous_id!)

  if (uploadRowsError) {
    console.error('[workspace:page] uploadRows query error:', uploadRowsError.message, uploadRowsError.code)
  }

  if (uploadRows?.[0]) {
    const row = uploadRows[0]
    uploadId = row.id ?? null
    initialParseStatus = (row.parse_status as 'pending' | 'processing' | 'completed' | 'failed') ?? 'pending'
    if (row.parse_status === 'completed' && row.parsed_data) {
      initialParsedData = row.parsed_data as typeof initialParsedData
    }
    if (row.photo_extracted_path) {
      initialPhotoPath = row.photo_extracted_path
    }
    if (row.file_path) {
      uploadFilePath = row.file_path
      // Derive file type from extension
      const ext = row.file_path.split('.').pop()?.toLowerCase() ?? ''
      uploadFileType = ext || null
    }
  }

  // Only pass pre-loaded experiences when parse is already complete.
  // If parsing is still in progress (pending/processing), start with an empty
  // slate so the workspace shows the loading state, not stale data from a
  // previous upload. refreshExperiences() will populate them once parse completes.
  const preloadedExperiences =
    initialParseStatus === 'completed' ? (experiences ?? []) : []

  return (
    <WorkspaceClient
      initialExperiences={preloadedExperiences}
      anonymousId={anonymous_id!}
      userId={user?.id ?? null}
      profile={profile}
      locale={locale}
      initialParseStatus={initialParseStatus}
      initialParsedData={initialParsedData}
      initialPhotoPath={initialPhotoPath}
      uploadFilePath={uploadFilePath}
      uploadFileType={uploadFileType}
      uploadId={uploadId ?? undefined}
    />
  )
}
