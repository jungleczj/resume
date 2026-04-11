import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createAnonClient } from '@supabase/supabase-js'

export interface EventProperties {
  anonymous_id?: string
  user_id?: string
  page_path?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  market?: string
  geo_country?: string
  [key: string]: unknown
}

// Key events as defined in AGENT_RULES.md
export type EventName =
  | 'page_view'
  | 'f1_upload_started'
  | 'f1_parse_completed'
  | 'jd_pasted'
  | 'resume_generated'
  | 'achievement_dragged'
  | 'photo_toggled'
  | 'photo_uploaded'
  | 'export_clicked'
  | 'payment_initiated'
  | 'payment_completed'
  | 'export_completed'
  | 'ai_call_completed'
  | 'ai_model_fallback'
  | 'notion_connected'
  | 'notion_sync_completed'
  | 'user_signup'
  | 'market_confirmed'
  | (string & {}) // allow custom events

// T-S02-4: cached geo country from the x-geo-country cookie (set by middleware)
// Lazy-loaded once per client session.
let _cachedGeo: string | null | undefined = undefined

function getGeoCountry(): string | null {
  if (typeof document === 'undefined') return null
  if (_cachedGeo !== undefined) return _cachedGeo
  // Try to read from meta tag injected by server component, or fall back to nothing.
  // The actual value is set by middleware as x-geo-country response header.
  // WorkspaceClient can call setGeoCountry() after reading from /api/geo.
  const meta = document.querySelector('meta[name="x-geo-country"]')
  _cachedGeo = meta?.getAttribute('content') ?? null
  return _cachedGeo
}

/** Called by client components that received the geo country from server */
export function setGeoCountry(country: string | null) {
  _cachedGeo = country
}

export async function trackEvent(
  eventName: EventName,
  properties: EventProperties = {}
): Promise<void> {
  try {
    const isServer = typeof window === 'undefined'
    let userId: string | null = properties.user_id ?? null

    // Client-side: resolve auth user from browser session
    if (!isServer && !userId) {
      const browserClient = createBrowserClient()
      const { data: { user } } = await browserClient.auth.getUser()
      userId = user?.id ?? null
    }

    // Use a plain anon client for the insert — safe in both client and server contexts.
    const supabase = isServer
      ? createAnonClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
      : createBrowserClient()

    // T-S02-4: include geo_country in every event
    const geoCountry = properties.geo_country ?? (isServer ? null : getGeoCountry())

    // Fire-and-forget: don't block the caller
    void supabase.from('analytics_events').insert({
      user_id: userId,
      anonymous_id: properties.anonymous_id ?? (isServer ? null : getAnonymousId()),
      event_name: eventName,
      properties,
      page_path: properties.page_path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      referrer: properties.referrer ?? (typeof document !== 'undefined' ? document.referrer : null),
      utm_source: properties.utm_source ?? getUTMParam('utm_source'),
      utm_medium: properties.utm_medium ?? getUTMParam('utm_medium'),
      utm_campaign: properties.utm_campaign ?? getUTMParam('utm_campaign'),
      market: properties.market ?? null,
      geo_country: geoCountry,
    })
  } catch {
    // Analytics must never break the main flow
  }
}

function getAnonymousId(): string {
  if (typeof localStorage === 'undefined') return ''
  let id = localStorage.getItem('cf_anonymous_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('cf_anonymous_id', id)
  }
  return id
}

function getUTMParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}
