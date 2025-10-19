/**
 * CODE INSIGHT
 * This code's use case is to serve the category breakdown report API for Tris. It aggregates transactions by category
 * within a given date range and optional filters, returning totals, counts, and percentages for charting and insights.
 * This code's full epic context is the Reports feature: URL params drive data queries with proper timezone handling
 * and RLS via Supabase. It powers the /reports/categories page with consistent filter semantics across reports.
 * This code's ui feel is API-only: fast, reliable JSON responses with strict validation and helpful error messages.
 */

import { NextResponse } from 'next/server'
import { DateTime } from 'luxon'
import { supabaseServer } from '@/utils/supabase/client-server'

export const dynamic = 'force-dynamic'

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function toUtcIsoStartOfDay(dateISO: string, tz: string) {
  const dt = DateTime.fromISO(dateISO, { zone: tz }).startOf('day')
  if (!dt.isValid) return null
  return dt.toUTC().toISO()
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const tz = url.searchParams.get('tz') || 'Asia/Seoul'
    const method = url.searchParams.get('method') || undefined
    const categoryIdParam = url.searchParams.get('categoryId') || ''

    if (!start || !end) return badRequest('Missing required params: start, end')

    // Auth guard: ensure a user session exists so RLS scopes queries correctly
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr) {
      return NextResponse.json({ error: 'Failed to validate session', details: userErr.message }, { status: 401 })
    }
    if (!userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Convert local date boundaries (in tz) to UTC instants for filtering
    const startUtcIso = toUtcIsoStartOfDay(start, tz)
    const endUtcIso = toUtcIsoStartOfDay(end, tz)
    if (!startUtcIso || !endUtcIso) return badRequest('Invalid start or end date, or timezone (tz)')
    if (DateTime.fromISO(endUtcIso) <= DateTime.fromISO(startUtcIso)) return badRequest('Invalid range: end must be after start')

    // Parse optional category filters (comma-separated UUIDs)
    const categoryIds = categoryIdParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    // Build query: aggregate by category using PostgREST aggregate functions
    let query = supabaseServer
      .from('transactions')
      .select(
        `
        category_id,
        categories(name),
        total:amount.sum(),
        tx_count:id.count()
      `
      )
      .gte('occurred_at', startUtcIso)
      .lt('occurred_at', endUtcIso)

    if (method) {
      query = query.eq('payment_method', method)
    }

    if (categoryIds.length > 0) {
      query = query.in('category_id', categoryIds)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch category aggregates', details: error.message }, { status: 500 })
    }

    // Safety: normalize and compute grand total for percentages
    const rows = Array.isArray(data) ? data : []

    type Row = {
      category_id: string | null
      categories: { name: string | null } | null
      total: number | null
      tx_count: number | null
    }

    const normalized = (rows as Row[]).map((r) => ({
      categoryId: r.category_id,
      categoryName: r.categories?.name ?? 'Uncategorized',
      total: Number(r.total ?? 0),
      count: Number(r.tx_count ?? 0),
    }))

    const grandTotal = normalized.reduce((sum, r) => sum + (Number.isFinite(r.total) ? r.total : 0), 0)

    const result = normalized
      .map((r) => ({
        ...r,
        percentage: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', details: e?.message ?? String(e) }, { status: 500 })
  }
}
