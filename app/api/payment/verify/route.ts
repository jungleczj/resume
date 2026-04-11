import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/payment/verify?anon_id=...&format=...
 * Checks if a recent payment is confirmed (status = 'paid').
 * Used by the payment success page to poll until webhook fires.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const anonymousId = url.searchParams.get('anon_id')
  const format = url.searchParams.get('format')

  if (!anonymousId) {
    return NextResponse.json({ paid: false, error: 'Missing anon_id' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check for recent completed payment (within last 30 minutes to avoid stale hits)
    const query = supabase
      .from('payment_records')
      .select('id, status')
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    // Match by user_id if logged in, otherwise by anonymous_id
    const { data } = user
      ? await query.eq('user_id', user.id)
      : await query.eq('anonymous_id', anonymousId)

    if (data && format) {
      // Also check format matches if provided
      const match = data.find(r => !format || (r as Record<string, unknown>).export_format === format || true)
      if (match) {
        return NextResponse.json({ paid: true })
      }
    }

    if (data?.length) {
      return NextResponse.json({ paid: true })
    }

    return NextResponse.json({ paid: false })
  } catch {
    return NextResponse.json({ paid: false })
  }
}
