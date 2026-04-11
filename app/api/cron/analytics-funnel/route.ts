/**
 * Daily Funnel Aggregation Cron Job (T-C1-4)
 *
 * Triggered by Vercel Cron at 01:00 UTC daily.
 * Reads yesterday's analytics_events → upserts analytics_funnels (CN + EN rows).
 * Also aggregates payment_records → analytics_revenue.
 *
 * Vercel Cron config is in vercel.json at project root.
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds

export async function GET(req: NextRequest) {
  // Validate Vercel Cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Yesterday's date (UTC)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const dateStr = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD

  const markets = ['cn', 'en'] as const

  for (const market of markets) {
    // Count distinct users at each funnel step for yesterday
    const paymentMarket = market === 'cn' ? 'cn_free' : 'en_paid'

    const stepEvents = [
      { column: 'visited',          event: 'page_view' },
      { column: 'f1_uploaded',      event: 'f1_upload_started' },
      { column: 'workspace_entered',event: 'f1_parse_completed' },
      { column: 'generated',        event: 'resume_generated' },
      { column: 'export_clicked',   event: 'export_clicked' },
      { column: 'paid',             event: 'payment_completed' },
      { column: 'registered',       event: 'user_signup' },
    ] as const

    const row: Record<string, string | number> = { date: dateStr, market }

    for (const step of stepEvents) {
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', step.event)
        .eq('market', paymentMarket)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at', `${dateStr}T23:59:59Z`)

      row[step.column] = count ?? 0
    }

    await supabase
      .from('analytics_funnels')
      .upsert(row, { onConflict: 'date,market' })
  }

  // Revenue aggregation
  const { data: payments } = await supabase
    .from('payment_records')
    .select('plan_type, amount_usd')
    .gte('created_at', `${dateStr}T00:00:00Z`)
    .lt('created_at', `${dateStr}T23:59:59Z`)

  if (payments?.length) {
    // Group by plan_type
    const byPlan: Record<string, { total: number; count: number }> = {}
    for (const p of payments) {
      const key = p.plan_type ?? 'unknown'
      if (!byPlan[key]) byPlan[key] = { total: 0, count: 0 }
      byPlan[key].total += p.amount_usd ?? 0
      byPlan[key].count += 1
    }

    for (const [plan_type, { total, count }] of Object.entries(byPlan)) {
      await supabase
        .from('analytics_revenue')
        .upsert(
          { date: dateStr, plan_type, amount_usd: total, transaction_count: count },
          { onConflict: 'date,plan_type' }
        )
    }
  }

  return NextResponse.json({ ok: true, date: dateStr, processed_markets: markets })
}
