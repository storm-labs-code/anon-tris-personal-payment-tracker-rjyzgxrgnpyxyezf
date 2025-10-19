"use server"

/**
 * CODE INSIGHT
 * Server actions for Upcoming page: perform occurrence mutations (pay, confirm, skip, snooze)
 * with Supabase RLS-respecting queries. All updates are scoped to the current user session.
 */

import { supabaseServer } from '@/utils/supabase/client-server'
import { revalidatePath } from 'next/cache'

function assertUser = async () => {
  const { data: auth, error } = await supabaseServer.auth.getUser()
  if (error || !auth?.user) throw new Error('Unauthorized')
  return auth.user
}

export async function markPaid({ occurrenceId, amount, paidAt }: { occurrenceId: string; amount?: number; paidAt?: string }) {
  const user = await assertUser()

  // Fetch occurrence with its recurring rule
  const { data: occ, error: occErr } = await supabaseServer
    .from('recurring_occurrences')
    .select('id, occurs_on, status, transaction_id, recurring_transaction_id')
    .eq('user_id', user.id)
    .eq('id', occurrenceId)
    .maybeSingle()
  if (occErr) throw occErr
  if (!occ) throw new Error('Occurrence not found')

  const { data: rule, error: ruleErr } = await supabaseServer
    .from('recurring_transactions')
    .select('id, amount, category_id, payee, payment_method, notes')
    .eq('user_id', user.id)
    .eq('id', occ.recurring_transaction_id)
    .maybeSingle()
  if (ruleErr) throw ruleErr
  if (!rule) throw new Error('Rule not found')

  const amt = typeof amount === 'number' && !Number.isNaN(amount) ? Math.round(amount) : (rule.amount ?? 0)
  const occurred_at = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString()

  let txId = occ.transaction_id as string | null
  if (txId) {
    const { error: upErr } = await supabaseServer
      .from('transactions')
      .update({ amount: amt, occurred_at, category_id: rule.category_id, payee: rule.payee, payment_method: rule.payment_method, notes: rule.notes })
      .eq('user_id', user.id)
      .eq('id', txId)
    if (upErr) throw upErr
  } else {
    const { data: ins, error: insErr } = await supabaseServer
      .from('transactions')
      .insert({ user_id: user.id, amount: amt, occurred_at, category_id: rule.category_id, payee: rule.payee, payment_method: rule.payment_method, notes: rule.notes })
      .select('id')
      .single()
    if (insErr) throw insErr
    txId = ins.id
    const { error: linkErr } = await supabaseServer
      .from('recurring_occurrences')
      .update({ transaction_id: txId })
      .eq('user_id', user.id)
      .eq('id', occ.id)
    if (linkErr) throw linkErr
  }

  const { error: stErr } = await supabaseServer
    .from('recurring_occurrences')
    .update({ status: 'paid' })
    .eq('user_id', user.id)
    .eq('id', occ.id)
  if (stErr) throw stErr

  revalidatePath('/upcoming')
  return { ok: true, transaction_id: txId }
}

export async function confirmOccurrence({ occurrenceId }: { occurrenceId: string }) {
  const user = await assertUser()

  const { data: occ, error: occErr } = await supabaseServer
    .from('recurring_occurrences')
    .select('id, occurs_on, status, transaction_id, recurring_transaction_id')
    .eq('user_id', user.id)
    .eq('id', occurrenceId)
    .maybeSingle()
  if (occErr) throw occErr
  if (!occ) throw new Error('Occurrence not found')

  const { data: rule, error: ruleErr } = await supabaseServer
    .from('recurring_transactions')
    .select('id, amount, category_id, payee, payment_method, notes')
    .eq('user_id', user.id)
    .eq('id', occ.recurring_transaction_id)
    .maybeSingle()
  if (ruleErr) throw ruleErr
  if (!rule) throw new Error('Rule not found')

  // If a transaction already exists, just set status to confirmed
  let txId = occ.transaction_id as string | null
  if (!txId) {
    // Create a pending transaction (no status in schema; we just create with occurs_on date)
    const occurred_at = new Date(occ.occurs_on + 'T00:00:00Z').toISOString()
    const { data: ins, error: insErr } = await supabaseServer
      .from('transactions')
      .insert({ user_id: user.id, amount: rule.amount ?? 0, occurred_at, category_id: rule.category_id, payee: rule.payee, payment_method: rule.payment_method, notes: rule.notes })
      .select('id')
      .single()
    if (insErr) throw insErr
    txId = ins.id
    const { error: linkErr } = await supabaseServer
      .from('recurring_occurrences')
      .update({ transaction_id: txId })
      .eq('user_id', user.id)
      .eq('id', occ.id)
    if (linkErr) throw linkErr
  }

  const { error: stErr } = await supabaseServer
    .from('recurring_occurrences')
    .update({ status: 'confirmed' })
    .eq('user_id', user.id)
    .eq('id', occ.id)
  if (stErr) throw stErr

  revalidatePath('/upcoming')
  return { ok: true, transaction_id: txId }
}

export async function skipOccurrence({ occurrenceId }: { occurrenceId: string }) {
  const user = await assertUser()
  const { error } = await supabaseServer
    .from('recurring_occurrences')
    .update({ status: 'skipped' })
    .eq('user_id', user.id)
    .eq('id', occurrenceId)
  if (error) throw error
  revalidatePath('/upcoming')
  return { ok: true }
}

export async function snoozeOccurrence({ occurrenceId, newDate }: { occurrenceId: string; newDate: string }) {
  const user = await assertUser()
  const isoDate = newDate.slice(0, 10)
  const { error } = await supabaseServer
    .from('recurring_occurrences')
    .update({ occurs_on: isoDate, snoozed_until: isoDate, status: 'snoozed' })
    .eq('user_id', user.id)
    .eq('id', occurrenceId)
  if (error) throw error
  revalidatePath('/upcoming')
  return { ok: true }
}
