/**
 * CODE INSIGHT
 * This code's use case is to provide a secure, authenticated API endpoint to return aggregated transaction totals
 * bucketed by day/week/month for the current user, respecting a specified or profile-derived timezone.
 * This code's full epic context is the Reports feature, which drives the Overview charts via URL-driven filters.
 * This code's ui feel is N/A (API only), but it prioritizes correctness, reliability, and clear error responses.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'
import {
  utcToZonedTime,
  formatInTimeZone,
} from 'date-fns-tz'
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  isValid as isValidDate,
} from 'date-fns'

// Helpers
function toSafeNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

type Granularity = 'daily' | 'weekly' | 'monthly'

function normalizeGranularity(g?: string | null): Granularity {
  if (g === 'weekly') return 'weekly'
  if (g === 'monthly') return 'monthly'
  return 'daily'
}

function getBucketStart(d: Date, granularity: Granularity): Date {
  if (granularity === 'weekly') return startOfWeek(d, { weekStartsOn: 1 })
  if (granularity === 'monthly') return startOfMonth(d)
  return startOfDay(d)
}

function getNextBucketStart(d: Date, granularity: Granularity): Date {
  if (granularity === 'weekly') return addWeeks(d, 1)
  if (granularity === 'monthly') return addMonths(d, 1)
  return addDays(d, 1)
}

function parseDateOnlyISO(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isValidDate(d)) return null
  return d
}

function sanitizeUuidList(csv?: string | null): string[] | null {
  if (!csv) return null
  const uuidRe = /^(\{)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(\})?$/
  const arr = csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => uuidRe.test(s))
  return arr.length ? arr : null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)

    const startParam = url.searchParams.get('start')
    const endParam = url.searchParams.get('end')
    const granularity = normalizeGranularity(url.searchParams.get('granularity'))
    const method = url.searchParams.get('method') || undefined
    const tzParam = url.searchParams.get('tz') || undefined
    const categoryCsv = url.searchParams.get('categoryId')

    const startDate = parseDateOnlyISO(startParam)
    const endDate = parseDateOnlyISO(endParam)

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Invalid or missing start/end. Expect ISO date strings (YYYY-MM-DD).' },
        { status: 400 }
      )
    }

    // Auth
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: 'Authentication error.' }, { status: 401 })
    }
    const user = authData?.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // Determine timezone: query param -> user_settings.time_zone -> default 'Asia/Seoul'
    let tz = tzParam
    if (!tz) {
      const { data: settings, error: settingsErr } = await supabaseServer
        .from('user_settings')
        .select('time_zone')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!settingsErr && settings?.time_zone) {
        tz = settings.time_zone as string
      } else {
        tz = 'Asia/Seoul'
      }
    }

    // Filters
    const categoryIds = sanitizeUuidList(categoryCsv) || undefined

    let query = supabaseServer
      .from('transactions')
      .select('id, amount, occurred_at')
      .eq('user_id', user.id)
      .gte('occurred_at', startDate.toISOString())
      .lt('occurred_at', endDate.toISOString())

    if (method) {
      query = query.eq('payment_method', method)
    }
    if (categoryIds) {
      query = query.in('category_id', categoryIds)
    }

    const { data: rows, error: rowsError } = await query

    if (rowsError) {
      return NextResponse.json({ error: 'Failed to fetch transactions.' }, { status: 500 })
    }

    type Tx = { id: string; amount: number | string; occurred_at: string }

    // Aggregate in server using timezone-aware bucketing mirroring Postgres date_trunc semantics
    const buckets = new Map<string, { start: Date; end: Date; total: number; count: number }>()

    for (const r of (rows || []) as Tx[]) {
      const zoned = utcToZonedTime(new Date(r.occurred_at), tz!)
      const bucketStart = getBucketStart(zoned, granularity)
      const bucketEnd = getNextBucketStart(bucketStart, granularity)
      const key = `${bucketStart.getTime()}-${granularity}`

      if (!buckets.has(key)) {
        buckets.set(key, { start: bucketStart, end: bucketEnd, total: 0, count: 0 })
      }
      const agg = buckets.get(key)!
      agg.total += toSafeNumber(r.amount)
      agg.count += 1
    }

    // Sort by bucket start ascending and format dates as YYYY-MM-DD in the specified tz
    const result = Array.from(buckets.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((b) => ({
        bucketStart: formatInTimeZone(b.start, tz!, 'yyyy-MM-dd'),
        bucketEnd: formatInTimeZone(b.end, tz!, 'yyyy-MM-dd'),
        total: Math.round(b.total),
        count: b.count,
      }))

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 }
    )
  }
}
