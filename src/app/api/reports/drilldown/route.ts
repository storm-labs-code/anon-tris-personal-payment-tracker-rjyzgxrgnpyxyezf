/**
 * CODE INSIGHT
 * This code's use case is the drilldown reports API endpoint that returns a paginated,
 * filterable list of transactions for the authenticated user, scoped by date range and optional filters.
 * This code's full epic context is the Reports module where client pages consume this endpoint using
 * URL-driven filters and React Query, ensuring realtime refetch on transaction changes.
 * This code's ui feel is irrelevant here; however, responses are optimized for mobile drilldown lists and
 * provide consistent, predictable fields consumed by charts and lists.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function isValidDate(value: string | null): value is string {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseCategoryIds(param: string | null): string[] | null {
  if (!param) return null
  const ids = param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length ? ids : null
}

// Minimal time zone handling: Asia/Seoul is fully supported (UTC+09:00, no DST). For other IANA zones,
// we fall back to UTC interpretation to keep behavior predictable without extra deps.
function isoAtZonedMidnight(dateStr: string, tz: string): string {
  if (tz === 'Asia/Seoul') {
    return new Date(`${dateStr}T00:00:00+09:00`).toISOString()
  }
  return new Date(`${dateStr}T00:00:00Z`).toISOString()
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const categoryIdParam = searchParams.get('categoryId')
    const method = searchParams.get('method')
    const orderByParam = (searchParams.get('orderBy') || 'date').toLowerCase()
    const orderParam = (searchParams.get('order') || 'desc').toLowerCase()
    const page = clamp(parsePositiveInt(searchParams.get('page'), 1), 1, 10_000)
    const pageSize = clamp(parsePositiveInt(searchParams.get('pageSize'), 50), 1, 200)
    const tz = searchParams.get('tz') || 'Asia/Seoul'

    if (!isValidDate(start) || !isValidDate(end)) {
      return NextResponse.json(
        { error: 'Invalid or missing start/end. Expected format: YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const startISO = isoAtZonedMidnight(start, tz)
    const endISO = isoAtZonedMidnight(end, tz)

    if (new Date(startISO) >= new Date(endISO)) {
      return NextResponse.json(
        { error: 'Invalid range: start must be before end (end is exclusive).' },
        { status: 400 }
      )
    }

    const { data: userData, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 })
    }
    const user = userData?.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categoryIds = parseCategoryIds(categoryIdParam)
    const orderByColumn = orderByParam === 'amount' ? 'amount' : 'occurred_at'
    const ascending = orderParam === 'asc'

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabaseServer
      .from('transactions')
      .select(
        `
        id,
        amount,
        occurred_at,
        category_id,
        payee,
        payment_method,
        notes,
        categories:category_id(name)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .gte('occurred_at', startISO)
      .lt('occurred_at', endISO)
      .order(orderByColumn, { ascending })
      .range(from, to)

    if (categoryIds) {
      query = query.in('category_id', categoryIds)
    }

    if (method) {
      query = query.eq('payment_method', method)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      amount: row.amount,
      currency: 'KRW',
      date: row.occurred_at,
      categoryId: row.category_id,
      categoryName: row.categories?.name ?? null,
      payee: row.payee,
      method: row.payment_method,
      notes: row.notes ?? null,
    }))

    const totalCount = count ?? 0
    const nextPage = to + 1 < totalCount ? page + 1 : null

    return NextResponse.json({ items, nextPage, totalCount })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
