import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/lib/i18n/navigation'
import { LibraryClient } from '@/components/library/LibraryClient'
import { NavBar } from '@/components/layout/NavBar'

interface LibraryPageProps {
  params: Promise<{ locale: string }>
}

export default async function LibraryPage({ params }: LibraryPageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect({ href: '/login', locale })
  }

  // Load all achievements grouped by work experience
  const { data: experiences } = await supabase
    .from('work_experiences')
    .select('*, achievements(*)')
    .eq('user_id', user!.id)
    .order('sort_order', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="pt-14">
        <LibraryClient
          experiences={experiences ?? []}
          profile={profile}
          userId={user!.id}
        />
      </div>
    </div>
  )
}
