import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { type NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // ── Geo country forwarding (T-S02-4) ─────────────────────────────────────
  // Used only for analytics and default UI language — never for payment logic.
  const geoCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('x-geo-country') ??
    null

  // Run i18n routing — no network calls, always safe in Edge
  const response = intlMiddleware(request)

  if (geoCountry && response) {
    response.headers.set('x-geo-country', geoCountry)
  }

  // ── Pricing route guard ───────────────────────────────────────────────────
  // Redirect cn_free users away from /pricing without touching Supabase SDK.
  // The cf_market cookie is written by /auth/callback on every login.
  // If the cookie is absent (anonymous / not logged in) we let the page through.
  const pathname = request.nextUrl.pathname
  const isPricingRoute = /\/(?:zh-CN|en-US)?\/pricing(?:\/|$)/.test(pathname) ||
    pathname === '/pricing'

  if (isPricingRoute) {
    const market = request.cookies.get('cf_market')?.value
    if (market === 'cn_free') {
      const localeMatch = pathname.match(/^\/(zh-CN|en-US)/)
      const locale = localeMatch ? localeMatch[1] : 'zh-CN'
      return NextResponse.redirect(new URL(`/${locale}/workspace`, request.url))
    }
  }

  return response ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|api|auth).*)']
}
