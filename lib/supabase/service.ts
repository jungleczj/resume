import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS entirely.
 * Only use in server-side API routes that require full DB access.
 * NEVER expose to the client.
 *
 * Uses a custom fetch with cache:'no-store' and a 30s timeout so that:
 *  a) Next.js's request-deduplication/caching layer is bypassed
 *     (Next.js patches globalThis.fetch; storage binary uploads break with caching)
 *  b) Stalled connections surface quickly instead of hanging indefinitely
 */
export function createServiceClient() {
  const customFetch: typeof globalThis.fetch = (url, init = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    return globalThis.fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: customFetch } }
  )
}
