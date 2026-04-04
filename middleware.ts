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
        setAll(cookiesToSet) {
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
  const pathname = request.nextUrl.pathname
  const isPricingRoute = pathname.match(/\/(?:zh-CN|en-US)?\/pricing/) ||
    pathname === '/pricing'

  if (isPricingRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('payment_market')
      .eq('id', user.id)
      .single()

    if (profile?.payment_market === 'cn_free') {
      const workspaceUrl = new URL('/workspace', request.url)
      return NextResponse.redirect(workspaceUrl)
    }
  }

  return response ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)']
}
