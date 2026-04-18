import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PricingClient from '@/components/pricing/PricingClient'

export default async function PricingPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // cn_free users should not see pricing — redirect to workspace
  const cookieStore = await cookies()
  const market = cookieStore.get('cf_market')?.value
  if (market === 'cn_free') {
    redirect(`/${locale}/workspace`)
  }

  return <PricingClient />
}
