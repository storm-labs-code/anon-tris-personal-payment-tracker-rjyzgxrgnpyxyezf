/**
 * CODE INSIGHT
 * This code's use case is to provide single-budget item mutations for Tris budgets via RESTful API endpoints.
 * This code's full epic context is the Budgets epic where clients can adjust or remove a single budget row; data may
 * reside in either category_budgets (per-category) or overall_budgets (global) tables. The handler validates Supabase
 * auth, enforces row ownership (user_id), and returns the modified or deleted record.
 * This code's ui feel is lean and reliable—fast responses with clear error semantics supporting optimistic UI updates.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status })
}

function isUuid(id: string) {
  return /^[0-9a-fA-F-]{36}$/.test(id)
}

function parseBodyNumber(n: unknown) {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  return null
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params?.id
    if (!id || !isUuid(id)) return json(400, { error: 'Invalid id' })

    const { data: userRes, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })
    const userId = userRes.user.id

    let payload: any
    try {
      payload = await req.json()
    } catch {
      return json(400, { error: 'Invalid JSON body' })
    }

    const amountRaw = payload?.amount
    const thresholdRaw = payload?.alert_threshold_percent ?? payload?.threshold_pct

    const updates: Record<string, any> = {}

    if (amountRaw !== undefined) {
      const amount = parseBodyNumber(amountRaw)
      if (amount === null || amount < 0) return json(400, { error: 'amount must be a non-negative number' })
      // KRW is integer; store rounded integer
      updates.amount = Math.round(amount)
    }

    if (thresholdRaw !== undefined) {
      const threshold = parseBodyNumber(thresholdRaw)
      if (threshold === null || threshold < 0 || threshold > 100)
        return json(400, { error: 'alert_threshold_percent must be a number between 0 and 100' })
      updates.alert_threshold_percent = Math.round(threshold)
    }

    if (Object.keys(updates).length === 0) return json(400, { error: 'No valid fields to update' })

    updates.updated_at = new Date().toISOString()

    // Try category_budgets first
    const { data: catData, error: catErr } = await supabaseServer
      .from('category_budgets')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (!catErr && catData) {
      return json(200, { kind: 'category', record: catData })
    }

    // If not found in category, try overall_budgets
    const { data: ovData, error: ovErr } = await supabaseServer
      .from('overall_budgets')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (!ovErr && ovData) {
      return json(200, { kind: 'overall', record: ovData })
    }

    // Determine 404 vs other errors
    if ((catErr && (catErr as any).code === 'PGRST116') || (ovErr && (ovErr as any).code === 'PGRST116')) {
      return json(404, { error: 'Budget not found' })
    }

    // If both errored, return last error details
    const errMsg = ovErr?.message || catErr?.message || 'Unknown error'
    return json(500, { error: 'Failed to update budget', details: errMsg })
  } catch (e: any) {
    return json(500, { error: 'Server error', details: e?.message || String(e) })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params?.id
    if (!id || !isUuid(id)) return json(400, { error: 'Invalid id' })

    const { data: userRes, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })
    const userId = userRes.user.id

    // Try to delete from category_budgets first returning old row
    const { data: catData, error: catErr } = await supabaseServer
      .from('category_budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (!catErr && catData) {
      return json(200, { kind: 'category', record: catData })
    }

    // Try overall_budgets
    const { data: ovData, error: ovErr } = await supabaseServer
      .from('overall_budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (!ovErr && ovData) {
      return json(200, { kind: 'overall', record: ovData })
    }

    if ((catErr && (catErr as any).code === 'PGRST116') || (ovErr && (ovErr as any).code === 'PGRST116')) {
      return json(404, { error: 'Budget not found' })
    }

    const errMsg = ovErr?.message || catErr?.message || 'Unknown error'
    return json(500, { error: 'Failed to delete budget', details: errMsg })
  } catch (e: any) {
    return json(500, { error: 'Server error', details: e?.message || String(e) })
  }
}
