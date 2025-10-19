/**
 * CODE INSIGHT
 * This code's use case is to finalize a recurring occurrence as paid by creating or updating a linked transaction
 * and updating the occurrence status. It is invoked by the client when a user marks a reminder occurrence as paid.
 * This code's full epic context is the Recurring Payments flow where occurrences can be confirmed, paid, skipped,
 * or snoozed, and paid actions materialize transactions in the transactions table while linking back to the occurrence.
 * This code's ui feel is consistent, reliable, and minimal; responses are precise JSON with clear error semantics
 * to enable smooth optimistic UI updates and trust-building feedback in the mobile-first PWA.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

export async function POST(req: Request, context: { params: { occurrenceId: string } }) {
  try {
    const occurrenceId = context?.params?.occurrenceId
    if (!occurrenceId || typeof occurrenceId !== 'string') {
      return NextResponse.json({ error: 'Invalid occurrenceId' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = authData.user.id

    const body = await req.json().catch(() => ({}))
    const rawAmount = body?.amount
    const paidAtRaw = body?.paid_at

    let amountProvided = false
    let amountValue: number | null = null

    if (rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
      const parsed = typeof rawAmount === 'string' ? Number(rawAmount) : rawAmount
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number (KRW)' }, { status: 422 })
      }
      amountProvided = true
      amountValue = Math.round(parsed)
    }

    let occurredAtISO: string | null = null
    if (paidAtRaw !== undefined && paidAtRaw !== null && paidAtRaw !== '') {
      const paidAtDate = new Date(paidAtRaw)
      if (isNaN(paidAtDate.getTime())) {
        return NextResponse.json({ error: 'paid_at must be a valid ISO datetime' }, { status: 422 })
      }
      occurredAtISO = paidAtDate.toISOString()
    } else {
      occurredAtISO = new Date().toISOString()
    }

    // Fetch the occurrence scoped to the current user
    const { data: occurrence, error: occErr } = await supabaseServer
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
          'reminder_sent_at',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .eq('id', occurrenceId)
      .eq('user_id', userId)
      .single()

    if (occErr || !occurrence) {
      return NextResponse.json({ error: 'Occurrence not found' }, { status: 404 })
    }

    // Fetch the recurring transaction template for defaults
    const { data: template, error: tmplErr } = await supabaseServer
      .from('recurring_transactions')
      .select(['id', 'user_id', 'amount', 'category_id', 'payee', 'payment_method', 'notes'].join(', '))
      .eq('id', occurrence.recurring_transaction_id)
      .eq('user_id', userId)
      .single()

    if (tmplErr || !template) {
      return NextResponse.json({ error: 'Recurring transaction template not found' }, { status: 409 })
    }

    const resolvedAmount = amountProvided ? (amountValue as number) : Number(template.amount)
    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
      return NextResponse.json({ error: 'Resolved amount is invalid' }, { status: 422 })
    }

    if (!template.payment_method) {
      return NextResponse.json({ error: 'Payment method is required to create a transaction' }, { status: 422 })
    }

    const nowISO = new Date().toISOString()

    // If a transaction already exists, update it accordingly
    if (occurrence.transaction_id) {
      const patch: Record<string, any> = { updated_at: nowISO }
      if (amountProvided) patch.amount = resolvedAmount
      if (occurredAtISO) patch.occurred_at = occurredAtISO

      const { data: updatedTx, error: updErr } = await supabaseServer
        .from('transactions')
        .update(patch)
        .eq('id', occurrence.transaction_id)
        .eq('user_id', userId)
        .select('id')
        .single()

      if (updErr || !updatedTx) {
        return NextResponse.json({ error: 'Failed to update existing transaction' }, { status: 500 })
      }

      const { data: updatedOccurrence, error: occUpdErr } = await supabaseServer
        .from('recurring_occurrences')
        .update({ status: 'paid', updated_at: nowISO })
        .eq('id', occurrence.id)
        .eq('user_id', userId)
        .select(
          [
            'id',
            'user_id',
            'recurring_transaction_id',
            'occurs_on',
            'status',
            'transaction_id',
            'snoozed_until',
            'reminder_sent_at',
            'created_at',
            'updated_at',
          ].join(', ')
        )
        .single()

      if (occUpdErr || !updatedOccurrence) {
        return NextResponse.json({ error: 'Failed to update occurrence status' }, { status: 500 })
      }

      return NextResponse.json({ transaction_id: updatedTx.id, occurrence: updatedOccurrence }, { status: 200 })
    }

    // No transaction exists yet: create one
    const insertPayload = {
      user_id: userId,
      amount: resolvedAmount,
      occurred_at: occurredAtISO,
      category_id: template.category_id ?? null,
      payee: template.payee ?? null,
      payment_method: template.payment_method,
      notes: template.notes ?? null,
      created_at: nowISO,
      updated_at: nowISO,
    }

    const { data: newTx, error: insErr } = await supabaseServer
      .from('transactions')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insErr || !newTx) {
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
    }

    const { data: updatedOccurrence, error: linkErr } = await supabaseServer
      .from('recurring_occurrences')
      .update({ transaction_id: newTx.id, status: 'paid', updated_at: nowISO })
      .eq('id', occurrence.id)
      .eq('user_id', userId)
      .select(
        [
          'id',
          'user_id',
          'recurring_transaction_id',
          'occurs_on',
          'status',
          'transaction_id',
          'snoozed_until',
          'reminder_sent_at',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .single()

    if (linkErr || !updatedOccurrence) {
      return NextResponse.json({ error: 'Failed to link transaction to occurrence' }, { status: 500 })
    }

    return NextResponse.json({ transaction_id: newTx.id, occurrence: updatedOccurrence }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
