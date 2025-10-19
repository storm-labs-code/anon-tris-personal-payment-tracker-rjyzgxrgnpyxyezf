/**
 * CODE INSIGHT
 * This code's use case is to provide server-side API handlers for a single recurring occurrence resource.
 * This code's full epic context is the Recurring Payments & Reminders flow where users manage upcoming occurrences,
 * confirm them (creating a pending transaction), snooze to a new date, or skip. It ensures RLS-scoped access via Supabase,
 * validates user ownership, and enforces safe state transitions aligned with the Epic's data flow.
 * This code's ui feel is calm and reliable, with precise error responses that allow a smooth client UX with optimistic updates.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

// Helpers
function json(data: unknown, init?: number | ResponseInit) {
  if (typeof init === 'number') return NextResponse.json(data, { status: init })
  return NextResponse.json(data, init)
}

function isValidISODateString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  // Accept YYYY-MM-DD or full ISO; normalize by Date parsing
  const d = new Date(value)
  return !isNaN(d.getTime())
}

function normalizeToDateOnlyISO(value: string): string {
  // If value includes time, keep date part; else return as-is
  const d = new Date(value)
  // Ensure date-only in UTC to avoid drift
  const year = d.getUTCFullYear()
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET(_req: Request, { params }: { params: { occurrenceId: string } }) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) return json({ error: 'Unauthorized' }, 401)

    const occurrenceId = params.occurrenceId
    if (!occurrenceId) return json({ error: 'Missing occurrenceId' }, 400)

    const { data, error } = await supabaseServer
      .from('recurring_occurrences')
      .select(
        [
          'id',
          'user_id',
          'recurring_transaction_id',
          'occurs_on',
          'status',
          'transaction_id',
          'snoozed_until',
          'created_at',
          'updated_at',
          // Expand parent rule for context
          'recurring_transactions(id, amount, category_id, payee, payment_method, notes, frequency, interval, start_date, end_date, is_active, reminder_enabled, reminder_time, auto_create_transactions)'
        ].join(',')
      )
      .eq('id', occurrenceId)
      .eq('user_id', authData.user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return json({ error: 'Not found' }, 404)
      return json({ error: 'Failed to load occurrence', details: error.message }, 500)
    }

    return json({ occurrence: data })
  } catch (e) {
    return json({ error: 'Unexpected server error', details: e instanceof Error ? e.message : String(e) }, 500)
  }
}

export async function PATCH(req: Request, { params }: { params: { occurrenceId: string } }) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) return json({ error: 'Unauthorized' }, 401)

    const occurrenceId = params.occurrenceId
    if (!occurrenceId) return json({ error: 'Missing occurrenceId' }, 400)

    const body = await req.json().catch(() => ({}))
    const action = body?.action as 'skip' | 'snooze' | 'confirm' | undefined
    if (!action) return json({ error: 'Missing action' }, 400)

    // Load occurrence with parent rule context
    const { data: occ, error: loadErr } = await supabaseServer
      .from('recurring_occurrences')
      .select(
        [
          'id',
          'user_id',
          'recurring_transaction_id',
          'occurs_on',
          'status',
          'transaction_id',
          'snoozed_until',
          'created_at',
          'updated_at',
          'recurring_transactions(id, amount, category_id, payee, payment_method, notes, frequency, interval, start_date, end_date, is_active, reminder_enabled, reminder_time, auto_create_transactions)'
        ].join(',')
      )
      .eq('id', occurrenceId)
      .eq('user_id', authData.user.id)
      .single()

    if (loadErr || !occ) {
      if (loadErr?.code === 'PGRST116') return json({ error: 'Not found' }, 404)
      return json({ error: 'Failed to load occurrence', details: loadErr?.message }, 500)
    }

    // Prevent transitions for finalized items
    const finalized = ['paid', 'skipped']
    if (finalized.includes(occ.status)) {
      return json({ error: `Cannot perform action on a ${occ.status} occurrence` }, 409)
    }

    if (action === 'skip') {
      const { data: updated, error: uErr } = await supabaseServer
        .from('recurring_occurrences')
        .update({ status: 'skipped' })
        .eq('id', occ.id)
        .eq('user_id', authData.user.id)
        .select(
          [
            'id',
            'user_id',
            'recurring_transaction_id',
            'occurs_on',
            'status',
            'transaction_id',
            'snoozed_until',
            'created_at',
            'updated_at'
          ].join(',')
        )
        .single()

      if (uErr) return json({ error: 'Failed to skip occurrence', details: uErr.message }, 500)
      return json({ occurrence: updated })
    }

    if (action === 'snooze') {
      const newDateRaw = body?.new_date
      if (!isValidISODateString(newDateRaw)) return json({ error: 'Invalid new_date' }, 400)
      const newDate = normalizeToDateOnlyISO(newDateRaw)

      const { data: updated, error: uErr } = await supabaseServer
        .from('recurring_occurrences')
        .update({ status: 'snoozed', snoozed_until: newDate, occurs_on: newDate })
        .eq('id', occ.id)
        .eq('user_id', authData.user.id)
        .select(
          [
            'id',
            'user_id',
            'recurring_transaction_id',
            'occurs_on',
            'status',
            'transaction_id',
            'snoozed_until',
            'created_at',
            'updated_at'
          ].join(',')
        )
        .single()

      if (uErr) return json({ error: 'Failed to snooze occurrence', details: uErr.message }, 500)
      return json({ occurrence: updated })
    }

    if (action === 'confirm') {
      // Ensure manual rule (auto_create disabled) per Epic
      const rule = (occ as any).recurring_transactions as
        | {
            id: string
            amount: number
            category_id: string | null
            payee: string | null
            payment_method: string
            notes: string | null
            auto_create_transactions: boolean
          }
        | null

      if (!rule) return json({ error: 'Parent rule not found for occurrence' }, 409)
      if (rule.auto_create_transactions) {
        return json({ error: 'Cannot confirm an auto-created rule occurrence' }, 400)
      }

      // If already has a transaction, ensure status is confirmed and return
      if (occ.transaction_id) {
        if (occ.status !== 'confirmed') {
          const { error: setErr } = await supabaseServer
            .from('recurring_occurrences')
            .update({ status: 'confirmed' })
            .eq('id', occ.id)
            .eq('user_id', authData.user.id)
          if (setErr) return json({ error: 'Failed to confirm occurrence', details: setErr.message }, 500)
        }
        return json({ occurrence: { ...occ, status: 'confirmed' }, transaction_id: occ.transaction_id })
      }

      // Create a pending transaction (no status column exists; occurrence.status tracks state)
      const occurredAt = new Date(occ.occurs_on)
      const insertPayload = {
        user_id: authData.user.id,
        amount: rule.amount,
        occurred_at: occurredAt.toISOString(),
        category_id: rule.category_id ?? null,
        payee: rule.payee ?? null,
        payment_method: rule.payment_method,
        notes: rule.notes ?? null
      }

      const { data: txInserted, error: txErr } = await supabaseServer
        .from('transactions')
        .insert(insertPayload)
        .select('id')
        .single()

      if (txErr) return json({ error: 'Failed to create transaction', details: txErr.message }, 500)

      const { data: updatedOcc, error: occErr } = await supabaseServer
        .from('recurring_occurrences')
        .update({ status: 'confirmed', transaction_id: txInserted.id })
        .eq('id', occ.id)
        .eq('user_id', authData.user.id)
        .select(
          [
            'id',
            'user_id',
            'recurring_transaction_id',
            'occurs_on',
            'status',
            'transaction_id',
            'snoozed_until',
            'created_at',
            'updated_at'
          ].join(',')
        )
        .single()

      if (occErr) return json({ error: 'Failed to link transaction to occurrence', details: occErr.message }, 500)

      return json({ occurrence: updatedOcc, transaction_id: txInserted.id })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (e) {
    return json({ error: 'Unexpected server error', details: e instanceof Error ? e.message : String(e) }, 500)
  }
}
