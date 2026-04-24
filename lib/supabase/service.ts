import { createClient } from '@supabase/supabase-js'
import { nodeFetch } from './native-fetch'

/**
 * Service-role Supabase client — bypasses RLS entirely.
 * Only use in server-side API routes that require full DB access.
 * NEVER expose to the client.
 *
 * Uses nodeFetch (node:https) instead of globalThis.fetch to avoid
 * "TypeError: fetch failed" errors caused by Next.js's patched undici
 * fetch in API route contexts. This matches the approach used by the
 * Supabase Storage native upload path, which is proven-reliable.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: nodeFetch as unknown as typeof globalThis.fetch,
      },
    },
  )
}
