import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { migrateAnonymousData } from '@/lib/utils/migrate-anonymous-data'
import { trackEvent } from '@/lib/analytics'

/**
 * /auth/callback
 * Handles both:
 *   1. OAuth (Google) – `code` query param + PKCE exchange
 *   2. Email magic-link – `code` param (Supabase OTP also uses PKCE exchange)
 *
 * IMPORTANT: The Supabase client must be created with cookies wired directly to
 * the redirect Response object. Using next/headers cookieStore here would write
 * session cookies to an internal store that is NOT included in the manually
 * created NextResponse.redirect() — causing the PKCE verifier to be consumed
 * but the session to never reach the browser.
 *
 * After successful session creation:
 *   - Migrates anonymous data to the authenticated user (if anonymous_id param present)
 *   - Sets cf_market cookie so middleware doesn't need to query DB on /pricing
 *   - Redirects to /{locale}/library (or the locale-prefixed `next` param)
 */

/** Supported locales — must match lib/i18n/routing.ts */
const LOCALES = ['zh-CN', 'en-US'] as const

/**
 * Resolve the locale to use for the post-login redirect.
 * Priority: NEXT_LOCALE cookie → Accept-Language header → default zh-CN
 */
function resolveLocale(req: NextRequest): string {
  const cookie = req.cookies.get('NEXT_LOCALE')?.value
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie
  const acceptLang = req.headers.get('accept-language') ?? ''
  if (/\ben\b/i.test(acceptLang)) return 'en-US'
  return 'zh-CN'
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/library'
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  const anonymousId = url.searchParams.get('anonymous_id')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const locale = resolveLocale(req)

  if (error) {
    // Redirect to locale-prefixed login on error
    return NextResponse.redirect(`${appUrl}/${locale}/login?error=${encodeURIComponent(errorDescription ?? error)}`)
  }

  // Prefix the `next` path with locale unless it already has one.
  // e.g. "/library" → "/zh-CN/library", "/zh-CN/workspace" → unchanged
  const nextPath = (LOCALES as readonly string[]).some(l => next.startsWith(`/${l}/`) || next === `/${l}`)
    ? next
    : `/${locale}${next.startsWith('/') ? next : `/${next}`}`

  // When we migrated anonymous data, append markers so the library page can:
  //  1. Show a "just synced" confirmation banner
  //  2. Fall back to anonymous_id query if migration partially failed
  const finalPath = anonymousId
    ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}synced=1&anonymous_id=${encodeURIComponent(anonymousId)}`
    : nextPath

  const redirectTarget = finalPath.startsWith('/') ? `${appUrl}${finalPath}` : finalPath
  const response = NextResponse.redirect(redirectTarget)

  // Create Supabase client wired to this response object so session cookies
  // (set during exchangeCodeForSession) are included in the redirect response.
  //
  // IMPORTANT: We filter out existing session cookies from getAll() so that
  // _recoverAndRefresh() finds no session and does NOT call _removeSession().
  // _removeSession() marks 'supabase.auth.token-code-verifier' as removed in
  // the in-memory removedItems map, which causes getItem() to return null for
  // the code verifier even though the cookie exists in req.cookies — resulting
  // in "PKCE code verifier not found in storage" on every login with a stale
  // session cookie present.
  const SESSION_STORAGE_KEY = 'supabase.auth.token'
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Return all cookies EXCEPT existing session chunks.
          // The code verifier (supabase.auth.token-code-verifier) is kept.
          return req.cookies.getAll().filter(({ name }) => {
            if (name === `${SESSION_STORAGE_KEY}-code-verifier`) return true
            if (name === SESSION_STORAGE_KEY) return false
            if (/^supabase\.auth\.token\.\d+$/.test(name)) return false
            return true
          })
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          })
        },
      },
    }
  )

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      const loginUrl = new URL('/login', appUrl)
      loginUrl.searchParams.set('error', exchangeError.message)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Get the now-authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Migrate anonymous session data to the user's account.
    // We AWAIT migration (up to 10 s) so the library page loads with data already
    // present. Fire-and-forget caused a race: the library queried user_id before
    // migration set user_id on the rows, returning an empty achievement list.
    if (anonymousId) {
      try {
        await Promise.race([
          migrateAnonymousData(anonymousId, user.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('migration timeout')), 10_000)
          ),
        ])
      } catch (err) {
        // Log but continue — partial migration is acceptable; the library will
        // show a sync prompt so the user can retry if something is missing.
        console.error('[auth/callback] migrateAnonymousData failed:', err)
      }
    }

    // Fetch payment_market and cache in a cookie so middleware avoids a DB round-trip
    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('payment_market, signup_geo_country')
      .eq('id', user.id)
      .single()

    if (profile?.payment_market) {
      // 7-day TTL — refreshed on next login
      response.cookies.set('cf_market', profile.payment_market, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    // T-S02-4: write signup_geo_country on first registration (only if not yet set)
    const geoCountry = req.headers.get('x-vercel-ip-country') ?? req.headers.get('x-geo-country')
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
    const isNewUser = Date.now() - createdAt < 60_000
    if (isNewUser && geoCountry && !profile?.signup_geo_country) {
      await serviceClient
        .from('profiles')
        .update({ signup_geo_country: geoCountry })
        .eq('id', user.id)
    }

    if (isNewUser) {
      void trackEvent('user_signup', {
        user_id: user.id,
        anonymous_id: anonymousId ?? undefined,
        method: user.app_metadata?.provider ?? 'unknown',
        market: profile?.payment_market ?? undefined,
        geo_country: geoCountry ?? undefined,
      })
    }
  }

  return response
}
