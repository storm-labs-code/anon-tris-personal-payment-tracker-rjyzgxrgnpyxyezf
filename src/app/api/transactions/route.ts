/**
 * CODE INSIGHT
 * This code's use case is to provide a minimal, authenticated POST endpoint for creating transactions
 * that validates the incoming payload shape and responds with a 501 to signal that full CRUD is handled
 * in a separate epic. It enables the UI's "Save to Server" button to show a clear, consistent response
 * without persisting any data.
 * This code's full epic context is the Transactions CRUD Epic integration, operating with Supabase Auth
 * for session enforcement in all /api routes. On missing auth it returns 401 so the client can fall back
 * to demo/local offline storage.
 * This code's ui feel is irrelevant (server-side), but responses are concise, consistent JSON with
 * appropriate HTTP statuses to support calm, trustworthy client UX.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

interface TransactionCreatePayload {
  amount: number
  date: string
  category_id?: string | null
  payee?: string | null
  notes?: string | null
  tag_names?: string[] | null
}

function isSafeInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isSafeInteger(n)
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const d = new Date(value)
  return !isNaN(d.getTime())
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validatePayload(body: unknown) {
  const errors: { field: string; message: string }[] = []

  if (typeof body !== 'object' || body === null) {
    return { ok: false as const, errors: [{ field: 'body', message: 'Invalid JSON body' }] }
  }

  const b = body as Record<string, unknown>

  // amount
  if (!isSafeInteger(b.amount)) {
    errors.push({ field: 'amount', message: 'amount must be a safe integer (KRW)' })
  }

  // date
  if (!isValidISODate(b.date)) {
    errors.push({ field: 'date', message: 'date must be an ISO-8601 date/time string' })
  }

  // category_id (optional)
  if (b.category_id !== undefined && b.category_id !== null) {
    if (typeof b.category_id !== 'string' || !UUID_V4_REGEX.test(b.category_id)) {
      errors.push({ field: 'category_id', message: 'category_id must be a valid UUID' })
    }
  }

  // payee (optional)
  if (b.payee !== undefined && b.payee !== null) {
    if (typeof b.payee !== 'string') {
      errors.push({ field: 'payee', message: 'payee must be a string' })
    } else if (b.payee.trim().length > 200) {
      errors.push({ field: 'payee', message: 'payee must be 200 characters or fewer' })
    }
  }

  // notes (optional)
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== 'string') {
      errors.push({ field: 'notes', message: 'notes must be a string' })
    } else if (b.notes.length > 2000) {
      errors.push({ field: 'notes', message: 'notes must be 2000 characters or fewer' })
    }
  }

  // tag_names (optional)
  if (b.tag_names !== undefined && b.tag_names !== null) {
    if (!Array.isArray(b.tag_names)) {
      errors.push({ field: 'tag_names', message: 'tag_names must be an array of strings' })
    } else {
      const invalid = (b.tag_names as unknown[]).some(
        (t) => typeof t !== 'string' || t.trim().length === 0 || t.length > 64,
      )
      if (invalid) {
        errors.push({ field: 'tag_names', message: 'each tag name must be a non-empty string up to 64 chars' })
      }
      if ((b.tag_names as unknown[]).length > 50) {
        errors.push({ field: 'tag_names', message: 'no more than 50 tags are allowed' })
      }
    }
  }

  if (errors.length) return { ok: false as const, errors }

  const sanitized: TransactionCreatePayload = {
    amount: b.amount as number,
    date: b.date as string,
    category_id: (b.category_id as string | null | undefined) ?? null,
    payee: (b.payee as string | null | undefined)?.trim() ?? null,
    notes: (b.notes as string | null | undefined) ?? null,
    tag_names: (Array.isArray(b.tag_names)
      ? (b.tag_names as string[]).map((t) => t.trim()).filter(Boolean)
      : null) ?? null,
  }

  return { ok: true as const, data: sanitized }
}

export async function POST(req: Request) {
  try {
    // Auth required for all /api routes per epic
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }

    const result = validatePayload(body)
    if (!result.ok) {
      return NextResponse.json({ message: 'Validation failed', errors: result.errors }, { status: 400 })
    }

    // Intentionally not persisting: stub endpoint
    return NextResponse.json(
      {
        message: 'Transaction CRUD is implemented in a separate Epic',
      },
      { status: 501 },
    )
  } catch (e) {
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
