import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const anonymousId = searchParams.get('anonymous_id')

  const supabase = await createClient()

  // Always derive user from the JWT — never trust a user_id query param
  // Wrap in try/catch: auth.getUser() can throw ECONNRESET on transient network errors
  let user: { id: string } | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[versions GET] auth.getUser attempt ${attempt + 1} failed:`, msg)
      if (attempt < 1) await new Promise(r => setTimeout(r, 300))
    }
  }

  const query = supabase
    .from('resume_versions')
    .select('id, snapshot_label, snapshot_jd, resume_lang, is_auto_save, show_photo, editor_json, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  let result
  if (user) {
    // Authenticated: scope to their own versions only
    result = await query.eq('user_id', user.id)
  } else if (anonymousId) {
    result = await query.eq('anonymous_id', anonymousId)
  } else {
    // Auth failed transiently AND no anonymous_id — return empty list, not 400
    // so the sidebar degrades gracefully instead of showing an error state
    console.warn('[versions GET] no identifier available (auth error + no anonymous_id) — returning []')
    return NextResponse.json({ data: [] })
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  return NextResponse.json({ data: result.data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      editor_json,
      anonymous_id,
      user_id,
      snapshot_label,
      snapshot_jd,
      resume_lang,
      show_photo,
    } = body

    if (!anonymous_id && !user_id) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
    }

    if (!editor_json) {
      return NextResponse.json({ error: 'Missing editor_json' }, { status: 400 })
    }

    // Use service client so anonymous users (no auth session) can insert their own rows
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('resume_versions')
      .insert({
        editor_json,
        anonymous_id: anonymous_id ?? null,
        user_id: user_id ?? null,
        snapshot_label: snapshot_label ?? null,
        snapshot_jd: snapshot_jd ?? null,
        resume_lang: resume_lang ?? 'zh',
        show_photo: show_photo ?? false,
        template_key: 'default',
        photo_path: null,
        is_auto_save: !snapshot_label,
      })
      .select('id, snapshot_label, snapshot_jd, resume_lang, is_auto_save, show_photo, editor_json, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
