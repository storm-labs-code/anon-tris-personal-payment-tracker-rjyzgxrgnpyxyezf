/**
 * CODE INSIGHT
 * This code's use case is to serve rolling trend data for reports via an authenticated API endpoint.
 * This code's full epic context is the Reports data flow where URL params drive fetching and charts, with RLS-enforced queries against Supabase and timezone-correct daily bucketing.
 * This code's ui feel is API-only, returning concise JSON optimized for mobile-first charts that need quick, reliable trend calculations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function isValidDateStr(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d)
}

function getDateList(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  while (cur < endDate) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function getFormatter(tz: string) {
  // en-CA ensures YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const windowParam = searchParams.get('window') || '30'
    const method = searchParams.get('method') || undefined
    const categoryIdParam = searchParams.get('categoryId') || ''
    const tz = searchParams.get('tz') || 'Asia/Seoul'

    if (!isValidDateStr(start) || !isValidDateStr(end)) {
      return badRequest('Invalid or missing start/end (expected YYYY-MM-DD)')
    }

    if (start >= end) {
      return badRequest('start must be earlier than end')
    }

    const windowSize = parseInt(windowParam, 10)
    if (![30, 90].includes(windowSize)) {
      return badRequest('window must be 30 or 90')
    }

    // Validate timezone
    try {
      // Will throw on invalid IANA TZ
      new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    } catch {
      return badRequest('Invalid tz')
    }

    // Auth check (RLS will scope data but we still ensure session exists)
    const { data: userData, error: userError } = await supabaseServer.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categoryIds = categoryIdParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    // We need to ensure we fetch all source rows that may map to the local-date window
    // Use a wide UTC buffer to safely capture timezone edges
    const startUTC = new Date(start + 'T00:00:00Z')
    const endUTC = new Date(end + 'T00:00:00Z')
    const bufferMs = 48 * 60 * 60 * 1000 // 48h buffer to cover TZ offsets and DST
    const gte = new Date(startUTC.getTime() - bufferMs).toISOString()
    const lt = new Date(endUTC.getTime() + bufferMs).toISOString()

    let query = supabaseServer
      .from('transactions')
      .select('id, occurred_at, amount, payment_method, category_id')
      .gte('occurred_at', gte)
      .lt('occurred_at', lt)
      .order('occurred_at', { ascending: true })

    if (method) {
      query = query.eq('payment_method', method)
    }

    if (categoryIds.length > 0) {
      query = query.in('category_id', categoryIds)
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const dates = getDateList(start, end)

    const fmt = getFormatter(tz)

    // Prepare map for daily totals
    const dailyMap = new Map<string, number>()
    for (const d of dates) dailyMap.set(d, 0)

    for (const r of rows || []) {
      const occurred = new Date(r.occurred_at as string)
      const localDate = fmt.format(occurred) // YYYY-MM-DD in tz
      // Only consider within [start, end) in local date
      if (localDate >= start && localDate < end) {
        const amtRaw = (r as any).amount
        const amt = typeof amtRaw === 'string' ? parseInt(amtRaw, 10) : (amtRaw as number)
        const prev = dailyMap.get(localDate) ?? 0
        dailyMap.set(localDate, prev + (Number.isFinite(amt) ? amt : 0))
      }
    }

    // Build ordered daily totals array
    const dailyTotals = dates.map((d) => dailyMap.get(d) ?? 0)

    // Rolling sum via prefix sums
    const prefix: number[] = new Array(dailyTotals.length + 1).fill(0)
    for (let i = 0; i < dailyTotals.length; i++) {
      prefix[i + 1] = prefix[i] + dailyTotals[i]
    }

    const result = dates.map((d, i) => {
      const startIdx = Math.max(0, i + 1 - windowSize)
      const rolling = prefix[i + 1] - prefix[startIdx]
      return {
        date: d,
        dailyTotal: dailyTotals[i],
        rollingTotal: rolling,
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error', detail: e?.message ?? String(e) }, { status: 500 })
  }
}
