/**
 * CODE INSIGHT
 * This code's use case is to provide an authenticated API for listing and materializing recurring occurrences
 * for a single user's recurring transactions. It exposes GET for filtered occurrence queries and POST for
 * idempotent generation of occurrences within a date range based on each rule's frequency and interval.
 * This code's full epic context is the Recurring Payments & Reminders flow, powering calendar and upcoming
 * views as well as background materialization tasks initiated by the client. It adheres strictly to the
 * available database schema (recurring_transactions and recurring_occurrences) and Supabase RLS via user scoping.
 * This code's ui feel is not applicable (API-only), but it supports a calm, reliable client UX by being robust,
 * predictable, and returning structured, actionable JSON with clear errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

// ---- Helpers: Date Parsing/Formatting ----
function isValidDateStr(s: string | null): s is string {
  if (!s) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !isNaN(d.getTime())
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function endOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1, 0) // day 0 of next month = last day of current month
  d.setHours(0, 0, 0, 0)
  return d
}

function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date)
  const targetMonth = d.getMonth() + months
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const originalDay = d.getDate()

  const tentative = new Date(targetYear, normalizedMonth, 1)
  const lastDay = endOfMonth(tentative).getDate()
  tentative.setDate(Math.min(originalDay, lastDay))
  tentative.setHours(0, 0, 0, 0)
  return tentative
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return new Date(min)
  if (date > max) return new Date(max)
  return date
}

// Compute the first occurrence on or after fromDate for a rule defined by startDate, interval, frequency
function firstOccurrenceOnOrAfter(startDate: Date, fromDate: Date, frequency: string, interval: number): Date | null {
  const start = new Date(startDate)
  const from = new Date(fromDate)
  if (interval < 1) interval = 1

  if (from <= start) return start

  switch (frequency) {
    case 'daily': {
      const diffDays = Math.floor((from.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const mod = diffDays % interval
      const add = mod === 0 ? 0 : interval - mod
      return addDays(from, add)
    }
    case 'weekly': {
      const diffDays = Math.floor((from.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const diffWeeks = Math.floor(diffDays / 7)
      const mod = diffWeeks % interval
      const addWeeks = mod === 0 ? 0 : interval - mod
      const candidate = addDays(start, (diffWeeks + addWeeks) * 7)
      if (candidate < from) return addDays(candidate, interval * 7)
      return candidate
    }
    case 'monthly': {
      const sY = start.getFullYear()
      const sM = start.getMonth()
      const fY = from.getFullYear()
      const fM = from.getMonth()
      const diffMonths = (fY - sY) * 12 + (fM - sM)
      const baseMonths = diffMonths - (diffMonths % interval)
      let candidate = addMonthsClamped(start, baseMonths)
      if (candidate < from) candidate = addMonthsClamped(candidate, interval)
      return candidate
    }
    default: {
      // Fallback: treat as daily
      const diffDays = Math.floor((from.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const mod = diffDays % interval
      const add = mod === 0 ? 0 : interval - mod
      return addDays(from, add)
    }
  }
}

function* iterateOccurrencesInRange(startDate: Date, endDate: Date | null, fromDate: Date, toDate: Date, frequency: string, interval: number): Generator<string> {
  const effectiveTo = endDate ? (toDate < endDate ? toDate : endDate) : toDate
  const first = firstOccurrenceOnOrAfter(startDate, fromDate, frequency, interval)
  if (!first) return
  let current = first
  while (current <= effectiveTo) {
    yield toISODate(current)
    switch (frequency) {
      case 'daily':
        current = addDays(current, Math.max(1, interval))
        break
      case 'weekly':
        current = addDays(current, Math.max(1, interval) * 7)
        break
      case 'monthly':
        current = addMonthsClamped(current, Math.max(1, interval))
        break
      default:
        current = addDays(current, Math.max(1, interval))
    }
  }
}

async function getAuthedUserId() {
  const { data, error } = await supabaseServer.auth.getUser()
  if (error || !data?.user) return null
  return data.user.id
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const statusParam = searchParams.get('status')

    if (!isValidDateStr(from) || !isValidDateStr(to)) {
      return NextResponse.json({ error: "Invalid or missing 'from'/'to' (expected YYYY-MM-DD)" }, { status: 400 })
    }

    if (parseISODate(from!) > parseISODate(to!)) {
      return NextResponse.json({ error: "'from' cannot be after 'to'" }, { status: 400 })
    }

    const statuses = statusParam ? statusParam.split(',').map(s => s.trim()).filter(Boolean) : []

    let query = supabaseServer
      .from('recurring_occurrences')
      .select('*')
      .eq('user_id', userId)
      .gte('occurs_on', from!)
      .lte('occurs_on', to!)
      .order('occurs_on', { ascending: true })

    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }

    const { data: occurrences, error: occErr } = await query
    if (occErr) {
      return NextResponse.json({ error: occErr.message }, { status: 500 })
    }

    const ruleIds = Array.from(new Set((occurrences ?? []).map(o => o.recurring_transaction_id).filter(Boolean)))
    let rulesById: Record<string, any> = {}
    if (ruleIds.length > 0) {
      const { data: rules, error: rulesErr } = await supabaseServer
        .from('recurring_transactions')
        .select('id, amount, category_id, payee, payment_method, notes, frequency, interval, start_date, end_date, is_active, auto_create_transactions, reminder_enabled, reminder_time')
        .eq('user_id', userId)
        .in('id', ruleIds)

      if (rulesErr) {
        return NextResponse.json({ error: rulesErr.message }, { status: 500 })
      }
      for (const r of rules || []) rulesById[r.id] = r
    }

    const items = (occurrences || []).map(o => ({
      ...o,
      recurring_transaction: rulesById[o.recurring_transaction_id] ?? null,
    }))

    return NextResponse.json({
      range: { from, to },
      filters: { status: statuses.length ? statuses : null },
      count: items.length,
      items,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const from: string | null = body?.from ?? null
    const to: string | null = body?.to ?? null

    if (!isValidDateStr(from) || !isValidDateStr(to)) {
      return NextResponse.json({ error: "Invalid or missing 'from'/'to' (expected YYYY-MM-DD)" }, { status: 400 })
    }

    const fromDate = parseISODate(from!)
    const toDate = parseISODate(to!)
    if (fromDate > toDate) {
      return NextResponse.json({ error: "'from' cannot be after 'to'" }, { status: 400 })
    }

    // Prevent unbounded large ranges
    const maxSpanDays = 366
    const spanDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    if (spanDays > maxSpanDays) {
      return NextResponse.json({ error: `Date range too large (>${maxSpanDays} days)` }, { status: 400 })
    }

    // Fetch all active rules for the user; we'll filter overlap in memory to avoid complex OR
    const { data: rules, error: rulesErr } = await supabaseServer
      .from('recurring_transactions')
      .select('id, start_date, end_date, frequency, interval, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (rulesErr) {
      return NextResponse.json({ error: rulesErr.message }, { status: 500 })
    }

    const overlappingRules = (rules || []).filter(r => {
      const s = parseISODate(r.start_date)
      const e = r.end_date ? parseISODate(r.end_date) : null
      // overlap exists if start <= to and (end is null or end >= from)
      const startsBeforeOrOnTo = s <= toDate
      const hasNotEndedBeforeFrom = !e || e >= fromDate
      return startsBeforeOrOnTo && hasNotEndedBeforeFrom
    })

    if (overlappingRules.length === 0) {
      return NextResponse.json({
        range: { from, to },
        rulesProcessed: 0,
        inserted: 0,
        byRule: {},
      })
    }

    const todayISO = toISODate(new Date())

    let totalInserted = 0
    const byRule: Record<string, number> = {}

    for (const rule of overlappingRules) {
      const start = parseISODate(rule.start_date)
      const end = rule.end_date ? parseISODate(rule.end_date) : null

      const genDates: string[] = []
      for (const d of iterateOccurrencesInRange(start, end, fromDate, toDate, rule.frequency, Math.max(1, rule.interval))) {
        genDates.push(d)
      }

      if (genDates.length === 0) {
        byRule[rule.id] = 0
        continue
      }

      // Fetch existing occurrences for this rule in range
      const { data: existing, error: existErr } = await supabaseServer
        .from('recurring_occurrences')
        .select('id, occurs_on')
        .eq('user_id', userId)
        .eq('recurring_transaction_id', rule.id)
        .gte('occurs_on', from!)
        .lte('occurs_on', to!)

      if (existErr) {
        return NextResponse.json({ error: existErr.message }, { status: 500 })
      }

      const existingSet = new Set((existing || []).map(e => e.occurs_on))

      const payload = genDates
        .filter(dateStr => !existingSet.has(dateStr))
        .map(dateStr => ({
          user_id: userId,
          recurring_transaction_id: rule.id,
          occurs_on: dateStr,
          status: dateStr >= todayISO ? 'upcoming' : 'upcoming',
          // snoozed_until, transaction_id, reminder_sent_at left null
        }))

      if (payload.length === 0) {
        byRule[rule.id] = 0
        continue
      }

      const { error: insertErr, count } = await supabaseServer
        .from('recurring_occurrences')
        .insert(payload, { count: 'exact' })

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }

      const insertedCount = count ?? payload.length
      totalInserted += insertedCount
      byRule[rule.id] = insertedCount
    }

    return NextResponse.json({
      range: { from, to },
      rulesProcessed: overlappingRules.length,
      inserted: totalInserted,
      byRule,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
