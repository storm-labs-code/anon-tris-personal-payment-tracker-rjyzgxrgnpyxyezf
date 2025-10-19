/**
 * CODE INSIGHT
 * This code's use case is to record a user's acknowledgement of budget alerts (approaching/exceeded)
 * so the same alert is not repeatedly shown within the same day. It supports POST only and requires auth.
 * This code's full epic context is the Budgets Overview alerts flow where dismissing an alert writes a row
 * to budget_alert_ack, and subsequent summary queries suppress acknowledged alerts for the day.
 * This code's ui feel is irrelevant (API-only), but it is designed for reliability, clear validation,
 * and idempotent behavior under duplicate acknowledgements.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function parseMonthYYYYMM(month: unknown): string | null {
  if (typeof month !== 'string') return null
  const m = month.trim()
  // Expecting YYYY-MM
  const match = /^(\d{4})-(\d{2})$/.exec(m)
  if (!match) return null
  const year = Number(match[1])
  const monthNum = Number(match[2])
  if (monthNum < 1 || monthNum > 12) return null
  // Construct first-of-month date string in ISO (date-only)
  const monthStart = `${match[1]}-${match[2]}-01`
  return monthStart
}

export async function POST(req: NextRequest) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) {
      return jsonError('Unauthorized', 401)
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return jsonError('Invalid content type. Expected application/json')
    }

    const body = (await req.json()) as {
      month?: unknown
      category_id?: unknown
      status?: unknown
    }

    const monthStart = parseMonthYYYYMM(body.month)
    if (!monthStart) return jsonError("Invalid 'month'. Expected format 'YYYY-MM'.")

    const status = typeof body.status === 'string' ? body.status.trim() : ''
    if (status !== 'approaching' && status !== 'exceeded') {
      return jsonError("Invalid 'status'. Must be 'approaching' or 'exceeded'.")
    }

    let categoryId: string | null = null
    if (body.category_id === null || body.category_id === undefined || body.category_id === '') {
      categoryId = null
    } else if (typeof body.category_id === 'string') {
      categoryId = body.category_id
    } else {
      return jsonError("Invalid 'category_id'. Must be a string UUID or null.")
    }

    const acknowledgedAt = new Date().toISOString()

    const { error: insertError } = await supabaseServer
      .from('budget_alert_ack')
      .insert({
        user_id: authData.user.id,
        month: monthStart,
        category_id: categoryId,
        status,
        acknowledged_at: acknowledgedAt,
      })

    if (insertError) {
      // If unique constraint prevents duplicate same-day acknowledgements, treat as success
      // Postgres unique violation code: 23505
      const pgErr = insertError as unknown as { code?: string; message?: string }
      if (pgErr?.code === '23505') {
        return NextResponse.json({
          ok: true,
          acknowledged: true,
          alreadyAcknowledgedToday: true,
          month: monthStart,
          category_id: categoryId,
          status,
        })
      }
      return jsonError(insertError.message || 'Failed to acknowledge alert', 500)
    }

    return NextResponse.json({
      ok: true,
      acknowledged: true,
      month: monthStart,
      category_id: categoryId,
      status,
      acknowledged_at: acknowledgedAt,
    })
  } catch (e) {
    return jsonError('Unexpected server error', 500)
  }
}
