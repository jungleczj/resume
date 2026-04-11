import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Run i18n middleware first
  const response = intlMiddleware(request)

  // Supabase session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (response) {
              response.cookies.set(name, value, options)
            }
          })
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Route guard: CN free users cannot access /pricing → redirect to /workspace
  // CRITICAL: uses payment_market, not geo.country
  // Uses cf_market cookie (set in /auth/callback) to avoid a DB round-trip per request.
  const pathname = request.nextUrl.pathname
  const isPricingRoute = pathname.match(/\/(?:zh-CN|en-US)?\/pricing/) ||
    pathname === '/pricing'

  if (isPricingRoute && user) {
    // Prefer cookie (fast path, set on login); fall back to DB only if cookie missing
    let market = request.cookies.get('cf_market')?.value
    if (!market) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_market')
        .eq('id', user.id)
        .single()
      market = profile?.payment_market ?? undefined
    }

    if (market === 'cn_free') {
      // Extract locale from pathname to preserve it in the redirect
      const localeMatch = pathname.match(/^\/(zh-CN|en-US)/)
      const locale = localeMatch ? localeMatch[1] : 'zh-CN'
      const workspaceUrl = new URL(`/${locale}/workspace`, request.url)
      return NextResponse.redirect(workspaceUrl)
    }
  }

  return response ?? NextResponse.next()
}

export const config = {
  // Exclude auth callback from i18n middleware — it must stay at /auth/callback (no locale prefix)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)']
}
