/**
 * CODE INSIGHT
 * This code's use case is to provide a secure, authenticated API route for managing an individual recurring transaction rule.
 * This code's full epic context is the Recurring Payments & Reminders flow: fetch a rule (GET), update rule fields and reconcile future occurrences (PATCH),
 * and soft-delete a rule while canceling future occurrences (DELETE). It uses Supabase with RLS and aligns with the project's data flow plan.
 * This code's ui feel is irrelevant (API route), but responses are consistent JSON with clear error codes for a reliable client UX.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

// Helpers
function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init)
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, { status: 401 })
}

function notFound() {
  return json({ error: 'Not found' }, { status: 404 })
}

function nowUtcISO() {
  return new Date().toISOString()
}

function toDateOnlyString(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateOnlyString(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (!m) return null
  const [y, mo, d] = s.split('-').map(Number)
  // Construct as UTC date
  return new Date(Date.UTC(y, mo - 1, d))
}

function addDaysUTC(d: Date, days: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + days)
  return r
}

function addWeeksUTC(d: Date, weeks: number): Date {
  return addDaysUTC(d, weeks * 7)
}

function addMonthsClampedUTC(d: Date, months: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const targetMonthIndex = m + months
  const targetYear = y + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  // Clamp day to end of month
  const endOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, endOfTargetMonth)
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay))
}

function minDate(a: Date, b: Date): Date { return a < b ? a : b }
function maxDate(a: Date, b: Date): Date { return a > b ? a : b }

// Generate occurrence dates within a window for the given rule using simple interval stepping from start_date
function generateOccurrenceDateStrings(opts: {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
  start_date: string
  end_date: string | null
  windowFrom: Date
  windowTo: Date
}): string[] {
  const startDate = parseDateOnlyString(opts.start_date)
  if (!startDate) return []
  const windowFrom = opts.windowFrom
  const windowTo = opts.windowTo
  if (windowFrom > windowTo) return []

  const interval = Math.max(1, Number(opts.interval || 1))
  const freq = opts.frequency
  const hardEnd = opts.end_date ? parseDateOnlyString(opts.end_date) : null
  const finalTo = hardEnd ? minDate(hardEnd, windowTo) : windowTo
  if (startDate > finalTo) return []

  // Start stepping from the first occurrence on or after windowFrom
  let cursor = startDate
  const advance = (d: Date) => {
    switch (freq) {
      case 'daily':
        return addDaysUTC(d, interval)
      case 'weekly':
        return addWeeksUTC(d, interval)
      case 'monthly':
        return addMonthsClampedUTC(d, interval)
      default:
        return addDaysUTC(d, interval)
    }
  }

  // Move cursor forward to >= windowFrom without overshooting interval alignment
  if (cursor < windowFrom) {
    if (freq === 'daily') {
      const diffDays = Math.floor((windowFrom.getTime() - cursor.getTime()) / (24 * 3600 * 1000))
      const steps = Math.floor(diffDays / interval)
      cursor = addDaysUTC(cursor, steps * interval)
      while (cursor < windowFrom) cursor = advance(cursor)
    } else if (freq === 'weekly') {
      const diffDays = Math.floor((windowFrom.getTime() - cursor.getTime()) / (24 * 3600 * 1000))
      const steps = Math.floor(diffDays / (7 * interval))
      cursor = addWeeksUTC(cursor, steps * interval)
      while (cursor < windowFrom) cursor = advance(cursor)
    } else if (freq === 'monthly') {
      // Monthly requires step until >= windowFrom
      while (cursor < windowFrom) cursor = advance(cursor)
    }
  }

  const dates: string[] = []
  while (cursor <= finalTo) {
    dates.push(toDateOnlyString(cursor))
    cursor = advance(cursor)
  }
  return dates
}

async function getAuthedUserId() {
  const { data: auth, error } = await supabaseServer.auth.getUser()
  if (error || !auth?.user) return null
  return auth.user.id
}

const SCHEDULE_FIELDS = new Set(['start_date', 'end_date', 'frequency', 'interval'])

function pickAllowedUpdateFields(body: any) {
  if (!body || typeof body !== 'object') return {}
  const allowed: Record<string, any> = {}
  const fields = [
    'amount',
    'category_id',
    'payee',
    'payment_method',
    'notes',
    'frequency',
    'interval',
    'start_date',
    'end_date',
    'is_active',
    'reminder_enabled',
    'reminder_time',
    'auto_create_transactions',
  ] as const

  for (const k of fields) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      let v = (body as any)[k]
      if (v === undefined) continue
      if (k === 'amount' || k === 'interval') {
        if (v === null || v === '') continue
        const num = Number(v)
        if (!Number.isFinite(num)) continue
        // Store as integer (bigint-compatible value). Client should send in minor unit (e.g., KRW as integer).
        v = Math.round(num)
      }
      if (k === 'start_date' || k === 'end_date') {
        if (v === null) {
          // allow null for end_date only
          if (k === 'end_date') {
            allowed[k] = null
            continue
          } else {
            continue
          }
        }
        const d = parseDateOnlyString(String(v))
        if (!d) continue
        v = toDateOnlyString(d)
      }
      if (k === 'frequency') {
        const f = String(v)
        if (!['daily', 'weekly', 'monthly'].includes(f)) continue
        v = f
      }
      if (k === 'is_active' || k === 'reminder_enabled' || k === 'auto_create_transactions') {
        v = Boolean(v)
      }
      allowed[k] = v
    }
  }
  return allowed
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthedUserId()
  if (!userId) return unauthorized()
  const id = params.id
  if (!id) return badRequest('Missing id')

  const { data: rule, error } = await supabaseServer
    .from('recurring_transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116' || (error as any).details?.includes('Results contain 0 rows')) return notFound()
    return json({ error: error.message }, { status: 500 })
  }
  if (!rule) return notFound()

  return json({ rule })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthedUserId()
  if (!userId) return unauthorized()
  const id = params.id
  if (!id) return badRequest('Missing id')

  let body: any
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  // Fetch current rule for comparison and ownership validation
  const { data: currentRule, error: fetchErr } = await supabaseServer
    .from('recurring_transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !currentRule) {
    if ((fetchErr as any)?.code === 'PGRST116') return notFound()
    return json({ error: fetchErr?.message || 'Failed to fetch rule' }, { status: 500 })
  }

  const updates = pickAllowedUpdateFields(body)
  if (Object.keys(updates).length === 0) {
    // No updates requested; return current
    return json({ rule: currentRule, reconciled: { inserted: 0, skipped: 0 } })
  }

  updates.updated_at = nowUtcISO()

  const { data: updatedRule, error: updateErr } = await supabaseServer
    .from('recurring_transactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (updateErr || !updatedRule) {
    return json({ error: updateErr?.message || 'Failed to update rule' }, { status: 500 })
  }

  // Determine if schedule changed: reconcile future occurrences if so
  let scheduleChanged = false
  for (const f of SCHEDULE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) {
      scheduleChanged = true
      break
    }
  }

  let inserted = 0
  let skipped = 0

  if (scheduleChanged) {
    try {
      const today = new Date()
      const windowTo = addDaysUTC(today, 90)

      const genDates = generateOccurrenceDateStrings({
        frequency: updatedRule.frequency,
        interval: updatedRule.interval,
        start_date: updatedRule.start_date,
        end_date: updatedRule.end_date,
        windowFrom: maxDate(parseDateOnlyString(updatedRule.start_date) || today, today),
        windowTo,
      })
      const newDateSet = new Set(genDates)

      // Load existing future occurrences
      const { data: existingOccs, error: occErr } = await supabaseServer
        .from('recurring_occurrences')
        .select('id, occurs_on, status')
        .eq('user_id', userId)
        .eq('recurring_transaction_id', id)
        .gte('occurs_on', toDateOnlyString(today))

      if (occErr) throw occErr

      const existingMap = new Map<string, { id: string; status: string }>()
      for (const o of existingOccs || []) {
        existingMap.set(o.occurs_on, { id: o.id, status: o.status })
      }

      // Compute inserts
      const toInsertDates: string[] = []
      for (const d of newDateSet) {
        if (!existingMap.has(d)) toInsertDates.push(d)
      }

      if (toInsertDates.length > 0) {
        const rows = toInsertDates.map((d) => ({
          user_id: userId,
          recurring_transaction_id: id,
          occurs_on: d,
          status: 'upcoming',
          created_at: nowUtcISO(),
          updated_at: nowUtcISO(),
        }))
        const { error: insertErr, count } = await supabaseServer
          .from('recurring_occurrences')
          .insert(rows, { count: 'exact' })
        if (insertErr) throw insertErr
        inserted = count ?? rows.length
      }

      // Compute skips: existing that are not in new set and are not paid/skipped
      const toSkipIds: string[] = []
      for (const [dateStr, info] of existingMap.entries()) {
        if (!newDateSet.has(dateStr)) {
          const st = String(info.status || '')
          if (st !== 'paid' && st !== 'skipped') {
            toSkipIds.push(info.id)
          }
        }
      }

      if (toSkipIds.length > 0) {
        const { error: skipErr, count } = await supabaseServer
          .from('recurring_occurrences')
          .update({ status: 'skipped', updated_at: nowUtcISO() })
          .in('id', toSkipIds)
          .select('id', { count: 'exact' })
        if (skipErr) throw skipErr
        skipped = count ?? toSkipIds.length
      }
    } catch (e: any) {
      return json({ rule: updatedRule, reconciled: { inserted, skipped }, warning: 'Rule updated, but occurrence reconciliation encountered an error', detail: e?.message ?? String(e) }, { status: 200 })
    }
  }

  return json({ rule: updatedRule, reconciled: { inserted, skipped } })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getAuthedUserId()
  if (!userId) return unauthorized()
  const id = params.id
  if (!id) return badRequest('Missing id')

  // Ensure it exists and belongs to the user
  const { data: existing, error: fetchErr } = await supabaseServer
    .from('recurring_transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !existing) {
    if ((fetchErr as any)?.code === 'PGRST116') return notFound()
    return json({ error: fetchErr?.message || 'Failed to fetch rule' }, { status: 500 })
  }

  // Soft-delete: set is_active = false
  const { data: updated, error: updErr } = await supabaseServer
    .from('recurring_transactions')
    .update({ is_active: false, updated_at: nowUtcISO() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (updErr || !updated) {
    return json({ error: updErr?.message || 'Failed to delete rule' }, { status: 500 })
  }

  // Cancel future occurrences by marking them skipped if not already terminal
  const todayStr = toDateOnlyString(new Date())
  const { data: occs, error: occErr } = await supabaseServer
    .from('recurring_occurrences')
    .select('id, status')
    .eq('user_id', userId)
    .eq('recurring_transaction_id', id)
    .gte('occurs_on', todayStr)

  if (occErr) {
    // Return success for rule update; include warning for occurrences
    return json({ success: true, rule: updated, warning: 'Rule deleted but failed to update occurrences', detail: occErr.message })
  }

  const toSkip = (occs || []).filter((o) => o.status !== 'paid' && o.status !== 'skipped').map((o) => o.id)
  if (toSkip.length > 0) {
    const { error: skipErr } = await supabaseServer
      .from('recurring_occurrences')
      .update({ status: 'skipped', updated_at: nowUtcISO() })
      .in('id', toSkip)
    if (skipErr) {
      return json({ success: true, rule: updated, warning: 'Rule deleted but failed to cancel some occurrences', detail: skipErr.message })
    }
  }

  return json({ success: true, rule: updated })
}
