import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // ── T-S02-4: Extract geo country and forward as a request header ─────────────
  const geoCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('x-geo-country') ??
    null

  // Run i18n middleware first — always safe, no network calls
  const response = intlMiddleware(request)

  if (geoCountry && response) {
    response.headers.set('x-geo-country', geoCountry)
  }

  // ── Route guard: /pricing → redirect cn_free users to /workspace ──────────
  // Only runs Supabase when the user is on a pricing page.
  const pathname = request.nextUrl.pathname
  const isPricingRoute = /\/(?:zh-CN|en-US)?\/pricing(?:\/|$)/.test(pathname) ||
    pathname === '/pricing'

  if (isPricingRoute) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response?.cookies.set(name, value, options)
              })
            }
          }
        })

        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
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
            const localeMatch = pathname.match(/^\/(zh-CN|en-US)/)
            const locale = localeMatch ? localeMatch[1] : 'zh-CN'
            return NextResponse.redirect(new URL(`/${locale}/workspace`, request.url))
          }
        }
      } catch {
        // Never crash the middleware — serve the pricing page as-is on any error
      }
    }
  }

  return response ?? NextResponse.next()
}

export const config = {
  // Exclude auth callback from i18n middleware — it must stay at /auth/callback (no locale prefix)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)']
}
