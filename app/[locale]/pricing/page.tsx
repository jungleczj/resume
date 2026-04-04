import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/lib/i18n/navigation'
import { PricingClient } from '@/components/pricing/PricingClient'
import { NavBar } from '@/components/layout/NavBar'

interface PricingPageProps {
  params: Promise<{ locale: string }>
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params
  const supabase = await createClient()
  let user: { id: string } | null = null
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) => setTimeout(() => resolve({ data: { user: null } }), 3000))
    ])
    user = (authResult as { data: { user: { id: string } | null } }).data.user
  } catch {
    // auth unavailable, treat as anonymous
  }

  // Route guard: CN free users → Workspace
  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user.id)
        .single()

      if (profile?.payment_market === 'cn_free') {
        redirect({ href: '/workspace', locale })
      }
    } catch {
      // profiles table may not exist yet
    }
  }

  // Load pricing from paywall_settings (hot-reloadable, with timeout)
  let settings: Record<string, unknown>[] = []
  try {
    const result = await Promise.race([
      supabase.from('paywall_settings').select('*').eq('market', 'en_paid').eq('is_enabled', true),
      new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000))
    ])
    settings = (result as { data: Record<string, unknown>[] | null }).data ?? []
  } catch {
    // table may not exist yet, use empty settings
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="pt-14">
        <PricingClient paywallSettings={settings ?? []} userId={user?.id ?? null} />
      </div>
    </div>
  )
}
