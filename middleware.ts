     import { type NextRequest, NextResponse } from 'next/server'

     // ── Constants ─────────────────────────────────────────────────────────────────
     const LOCALES = ['zh-CN', 'en-US'] as const
     type Locale = typeof LOCALES[number]
     const DEFAULT_LOCALE: Locale = 'zh-CN'
     // Header next-intl server components read for locale
     // Source: node_modules/next-intl/dist/esm/shared/constants.js
     const INTL_LOCALE_HEADER = 'X-NEXT-INTL-LOCALE'

     function detectLocale(request: NextRequest): Locale {
       // 1. NEXT_LOCALE cookie — set by next-intl router on locale toggle
       const saved = request.cookies.get('NEXT_LOCALE')?.value
       if (saved === 'zh-CN' || saved === 'en-US') return saved

       // 2. Accept-Language header — first-time visitors
       const al = request.headers.get('accept-language') ?? ''
       if (/\ben\b/i.test(al)) return 'en-US'

       return DEFAULT_LOCALE
     }

     export function middleware(request: NextRequest) {
       const { pathname } = request.nextUrl

       const geoCountry =
         request.headers.get('x-vercel-ip-country') ??
         request.headers.get('x-geo-country') ??
         null

       // ── Detect locale from URL prefix ─────────────────────────────────────────
       let urlLocale: Locale | null = null
       for (const loc of LOCALES) {
         if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
           urlLocale = loc
           break
         }
       }

       // ── Redirect: no locale prefix → add one ──────────────────────────────────
       if (!urlLocale) {
         const locale = detectLocale(request)
         const target = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
         const res = NextResponse.redirect(new URL(target, request.url))
         res.headers.set(INTL_LOCALE_HEADER, locale)
         if (geoCountry) res.headers.set('x-geo-country', geoCountry)
         return res
       }

       // ── Pricing route guard (cn_free → workspace) ──────────────────────────────
       const atPricing =
         pathname === `/${urlLocale}/pricing` ||
         pathname.startsWith(`/${urlLocale}/pricing/`)

       if (atPricing) {
         const market = request.cookies.get('cf_market')?.value
         if (market === 'cn_free') {
           const res = NextResponse.redirect(
             new URL(`/${urlLocale}/workspace`, request.url)
           )
           if (geoCountry) res.headers.set('x-geo-country', geoCountry)
           return res
         }
       }

       // ── Pass through — set locale header for server components ─────────────────
       const response = NextResponse.next()
       response.headers.set(INTL_LOCALE_HEADER, urlLocale)
       if (geoCountry) response.headers.set('x-geo-country', geoCountry)
       return response
     }

     export const config = {
       matcher: ['/((?!api|_next|.*\\..*).*)']
     }