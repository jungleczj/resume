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
 *   - Redirects to /library (or the `next` param)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/library'
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  const anonymousId = url.searchParams.get('anonymous_id')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin

  if (error) {
    const redirectUrl = new URL('/login', appUrl)
    redirectUrl.searchParams.set('error', errorDescription ?? error)
    return NextResponse.redirect(redirectUrl)
  }

  const redirectTarget = next.startsWith('/') ? `${appUrl}${next}` : next
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
    // Migrate anonymous session data to the user's account (fire-and-forget)
    if (anonymousId) {
      migrateAnonymousData(anonymousId, user.id).catch(err =>
        console.error('[auth/callback] migrateAnonymousData failed:', err)
      )
    }

    // Fetch payment_market and cache in a cookie so middleware avoids a DB round-trip
    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('payment_market')
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

    // Track signup for new users (created within the last 60s)
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
    const isNewUser = Date.now() - createdAt < 60_000
    if (isNewUser) {
      void trackEvent('user_signup', {
        user_id: user.id,
        anonymous_id: anonymousId ?? undefined,
        method: user.app_metadata?.provider ?? 'unknown',
        market: profile?.payment_market ?? undefined,
      })
    }
  }

  return response
}
