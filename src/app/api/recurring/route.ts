/**
 * CODE INSIGHT
 * This code's use case is to provide the Recurring API for listing and creating recurring transactions,
 * and to materialize initial upcoming occurrences for a short lookahead window.
 * This code's full epic context is the Recurring Payments flow: creating rules (recurring transactions),
 * generating upcoming occurrences, and returning data in shapes expected by the client (/api/recurring).
 * This code's ui feel is irrelevant (API-only); it focuses on robust validation, RLS-safe Supabase access,
 * and deterministic occurrence generation using rrule.
 */

import { NextResponse } from 'next/server'
import { RRule } from 'rrule'
import { supabaseServer } from '@/utils/supabase/client-server'

// Helpers
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function serverError(message = 'Internal Server Error', details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 500 })
}

function isValidDateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toDateAtUTC(dateOnly: string): Date {
  // Create a UTC date at 00:00:00Z
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

function formatDateOnlyUTC(d: Date): string {
  // Always serialize as YYYY-MM-DD using UTC
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysUTC(d: Date, days: number): Date {
  const result = new Date(d.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) return Math.trunc(Number(value))
  return null
}

function assertFrequency(value: unknown): value is 'daily' | 'weekly' | 'monthly' {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

function rruleFreqFromString(freq: 'daily' | 'weekly' | 'monthly') {
  switch (freq) {
    case 'daily':
      return RRule.DAILY
    case 'weekly':
      return RRule.WEEKLY
    case 'monthly':
      return RRule.MONTHLY
  }
}

async function generateInitialOccurrences(params: {
  userId: string
  recurringTransactionId: string
  startDate: string
  endDate?: string | null
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
}) {
  const { userId, recurringTransactionId, startDate, endDate, frequency, interval } = params

  // Determine lookahead: min(end_date, today + 90 days)
  const todayUTC = new Date()
  const todayUTCDateOnly = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()))
  const lookaheadEnd = addDaysUTC(todayUTCDateOnly, 90)

  const dtStart = toDateAtUTC(startDate)
  const hardEnd = endDate && isValidDateOnly(endDate) ? toDateAtUTC(endDate) : null
  const until = hardEnd ? minDate(hardEnd, lookaheadEnd) : lookaheadEnd

  // If until < dtStart, clamp to dtStart to at least generate the start occurrence
  const effectiveUntil = until.getTime() < dtStart.getTime() ? dtStart : until

  const rule = new RRule({
    freq: rruleFreqFromString(frequency),
    interval: Math.max(1, interval || 1),
    dtstart: dtStart,
    until: effectiveUntil,
  })

  const allDates = rule.all()
  if (!allDates.length) return 0

  const fromDateOnly = formatDateOnlyUTC(allDates[0])
  const toDateOnly = formatDateOnlyUTC(allDates[allDates.length - 1])

  // Fetch existing to avoid duplicates
  const { data: existing, error: existingErr } = await supabaseServer
    .from('recurring_occurrences')
    .select('occurs_on')
    .eq('user_id', userId)
    .eq('recurring_transaction_id', recurringTransactionId)
    .gte('occurs_on', fromDateOnly)
    .lte('occurs_on', toDateOnly)

  if (existingErr) throw existingErr

  const existingSet = new Set<string>((existing || []).map((r: any) => r.occurs_on as string))

  const rows = allDates
    .map((d) => formatDateOnlyUTC(d))
    .filter((dateOnly, idx, arr) => arr.indexOf(dateOnly) === idx) // ensure unique dates
    .filter((dateOnly) => !existingSet.has(dateOnly))
    .map((dateOnly) => ({
      user_id: userId,
      recurring_transaction_id: recurringTransactionId,
      occurs_on: dateOnly,
      status: 'upcoming',
    }))

  if (rows.length === 0) return 0

  const { error: insertErr } = await supabaseServer.from('recurring_occurrences').insert(rows)
  if (insertErr) throw insertErr
  return rows.length
}

export async function GET() {
  try {
    const { data: auth, error: authError } = await supabaseServer.auth.getUser()
    if (authError) return unauthorized()
    const user = auth?.user
    if (!user) return unauthorized()

    const { data, error } = await supabaseServer
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return serverError('Failed to fetch recurring rules', error.message)
    }

    // Return as { rules } for client consistency with epic
    return NextResponse.json({ rules: data ?? [] })
  } catch (e: any) {
    return serverError('Unexpected error while listing recurring rules', e?.message)
  }
}

export async function POST(req: Request) {
  try {
    const { data: auth, error: authError } = await supabaseServer.auth.getUser()
    if (authError) return unauthorized()
    const user = auth?.user
    if (!user) return unauthorized()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body')
    }

    const amount = parseAmount((body as any).amount)
    const payment_method = (body as any).payment_method
    const frequency = (body as any).frequency
    const start_date = (body as any).start_date

    if (amount === null) return badRequest('Field "amount" is required and must be a number')
    if (!payment_method || typeof payment_method !== 'string') return badRequest('Field "payment_method" is required')
    if (!assertFrequency(frequency)) return badRequest('Field "frequency" must be one of: daily, weekly, monthly')
    if (!isValidDateOnly(start_date)) return badRequest('Field "start_date" must be a date string in YYYY-MM-DD format')

    const intervalRaw = (body as any).interval
    const interval = Number.isInteger(intervalRaw) && intervalRaw > 0 ? intervalRaw : 1

    const end_date = (body as any).end_date
    if (end_date != null && !isValidDateOnly(end_date)) return badRequest('Field "end_date" must be a date string in YYYY-MM-DD format')
    if (end_date && toDateAtUTC(end_date).getTime() < toDateAtUTC(start_date).getTime()) {
      return badRequest('Field "end_date" must be on or after start_date')
    }

    const payload: Record<string, any> = {
      user_id: user.id,
      amount,
      payment_method,
      frequency, // stored as enum value
      interval,
      start_date,
      end_date: end_date ?? null,
      is_active: typeof (body as any).is_active === 'boolean' ? (body as any).is_active : true,
      auto_create_transactions:
        typeof (body as any).auto_create_transactions === 'boolean' ? (body as any).auto_create_transactions : false,
      reminder_enabled:
        typeof (body as any).reminder_enabled === 'boolean' ? (body as any).reminder_enabled : false,
      reminder_time: (body as any).reminder_time ?? null,
      category_id: (body as any).category_id ?? null,
      payee: (body as any).payee ?? null,
      notes: (body as any).notes ?? null,
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from('recurring_transactions')
      .insert(payload)
      .select('*')
      .single()

    if (insertErr || !inserted) {
      return serverError('Failed to create recurring rule', insertErr?.message)
    }

    // Generate initial occurrences (idempotent via pre-check of existing rows)
    let generatedCount = 0
    try {
      generatedCount = await generateInitialOccurrences({
        userId: user.id,
        recurringTransactionId: inserted.id,
        startDate: inserted.start_date,
        endDate: inserted.end_date,
        frequency: inserted.frequency,
        interval: inserted.interval,
      })
    } catch (occErr: any) {
      // Occurrence generation should not fully fail rule creation; return partial success with details.
      return NextResponse.json(
        {
          rule: inserted,
          generatedCount: 0,
          warning: 'Rule created but occurrences generation encountered an error',
          details: occErr?.message ?? String(occErr),
        },
        { status: 201 }
      )
    }

    return NextResponse.json({ rule: inserted, generatedCount }, { status: 201 })
  } catch (e: any) {
    return serverError('Unexpected error while creating recurring rule', e?.message)
  }
}
