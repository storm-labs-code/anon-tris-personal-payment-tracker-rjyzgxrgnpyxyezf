/**
 * CODE INSIGHT
 * This code's use case is to export a signed-in user's transactions as a CSV file over a GET API.
 * This code's full epic context is the Backup & Export flow, where users download scoped data for external use or backups. It must enforce auth, respect date range filters, and format CSV reliably.
 * This code's ui feel is invisible (API-only) but supports UX by providing proper headers for download, reliable error JSON, and no-store caching suitable for a PWA.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidDateString(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function toISOStartOfDay(dateStr: string): string {
  // Interpret as UTC start of day to create an inclusive date range
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString()
}

function toISOEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString()
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET(req: Request) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError) {
      return NextResponse.json(
        { code: 'AUTH_ERROR', message: 'Failed to authenticate user.' },
        { status: 401 }
      )
    }
    const user = authData?.user
    if (!user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Sign in required.' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const start = url.searchParams.get('start') || undefined
    const end = url.searchParams.get('end') || undefined

    if (start && !isValidDateString(start)) {
      return NextResponse.json(
        { code: 'INVALID_START', message: 'Invalid start date. Expected YYYY-MM-DD.' },
        { status: 400 }
      )
    }
    if (end && !isValidDateString(end)) {
      return NextResponse.json(
        { code: 'INVALID_END', message: 'Invalid end date. Expected YYYY-MM-DD.' },
        { status: 400 }
      )
    }
    if (start && end) {
      // Ensure logical range
      if (new Date(`${start}T00:00:00Z`).getTime() > new Date(`${end}T23:59:59Z`).getTime()) {
        return NextResponse.json(
          { code: 'INVALID_RANGE', message: 'The start date must be on or before the end date.' },
          { status: 400 }
        )
      }
    }

    let query = supabaseServer
      .from('transactions')
      .select(
        `id, occurred_at, amount, payee, payment_method, notes, categories(name), transaction_receipts(url)`
      )
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: true })

    if (start) {
      query = query.gte('occurred_at', toISOStartOfDay(start))
    }
    if (end) {
      query = query.lte('occurred_at', toISOEndOfDay(end))
    }

    const { data: rows, error } = await query
    if (error) {
      return NextResponse.json(
        { code: 'DB_QUERY_FAILED', message: error.message },
        { status: 500 }
      )
    }

    type TxRow = {
      id: string
      occurred_at: string
      amount: number
      payee: string | null
      payment_method: string
      notes: string | null
      categories?: { name: string | null } | null
      transaction_receipts?: { url: string }[] | null
    }

    const header = 'id,date,amount,category,payee,payment_method,notes,receipt_path'
    const lines: string[] = [header]

    for (const r of (rows || []) as TxRow[]) {
      const dateStr = (() => {
        try {
          // Output as YYYY-MM-DD using UTC to keep it consistent and predictable
          return new Date(r.occurred_at).toISOString().slice(0, 10)
        } catch {
          return ''
        }
      })()
      const categoryName = r.categories?.name ?? ''
      const receiptPath = Array.isArray(r.transaction_receipts) && r.transaction_receipts.length > 0
        ? r.transaction_receipts[0]?.url ?? ''
        : ''

      const rowCsv = [
        csvEscape(r.id),
        csvEscape(dateStr),
        csvEscape(r.amount ?? ''),
        csvEscape(categoryName),
        csvEscape(r.payee ?? ''),
        csvEscape(r.payment_method ?? ''),
        csvEscape(r.notes ?? ''),
        csvEscape(receiptPath),
      ].join(',')

      lines.push(rowCsv)
    }

    const csv = lines.join('\n')

    const filename = (() => {
      if (start && end) return `tris-transactions-${start.replaceAll('-', '')}-${end.replaceAll('-', '')}.csv`
      return 'tris-transactions-all.csv'
    })()

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { code: 'UNEXPECTED_ERROR', message: e?.message || 'Unexpected server error.' },
      { status: 500 }
    )
  }
}
