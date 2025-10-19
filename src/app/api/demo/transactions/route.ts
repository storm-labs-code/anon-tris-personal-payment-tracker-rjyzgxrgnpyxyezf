/**
 * CODE INSIGHT
 * This code's use case is to provide a demo, non-persistent transactions collection API for the Tris PWA.
 * This code's full epic context is to support client pages using SWR for paginated lists, POST creation with optimistic updates, optional artificial delay, and forced errors for testing UI states. It returns deterministic, generated data to keep list/detail routes stable without a database.
 * This code's ui feel is responsive and reliable: fast responses by default, predictable shapes, and clear error payloads that the client can surface with friendly alerts.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Types
interface DemoTransaction {
  id: string
  amount: number // in KRW (원)
  currency: 'KRW'
  occurred_at: string // ISO timestamp
  category: string | null
  payee: string | null
  payment_method: 'card' | 'cash' | 'transfer'
  notes: string | null
  created_at: string
  updated_at: string
}

interface GetResponse {
  items: DemoTransaction[]
  nextCursor?: string
  hasMore: boolean
}

// Demo dataset configuration
const TOTAL_ITEMS = 200
const CATEGORY_POOL = [
  'Food',
  'Transport',
  'Groceries',
  'Coffee',
  'Bills',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
]
const PAYEE_POOL = [
  'CU',
  'GS25',
  'Starbucks',
  'Paris Baguette',
  'KTX',
  'Hyundai Dept.',
  'Netflix',
  'City Gas',
  'Olive Young',
  'Lotteria',
  'Shinsegae',
]
const METHOD_POOL: DemoTransaction['payment_method'][] = ['card', 'cash', 'transfer']

// Utilities
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function parseIntSafe(s: string | null | undefined, fallback: number): number {
  if (s == null) return fallback
  const n = parseInt(String(s), 10)
  return Number.isFinite(n) ? n : fallback
}

function makeIdFromIndex(idx1: number): string {
  // idx1 is 1-based index for readability and stable IDs
  return `txn_${idx1}`
}

function generateAmountKRW(idx1: number): number {
  // Deterministic varied amounts: cycles and ranges
  const base = [1200, 2300, 3500, 4800, 7600, 11200, 15900, 22300, 31800, 45000]
  const bump = (idx1 % 7) * 500
  return Math.max(700, base[idx1 % base.length] + bump)
}

function generateOccurredAt(idx1: number): string {
  // Spread items over time in the past: every item is 6h apart with slight skew
  const now = Date.now()
  const sixHours = 6 * 60 * 60 * 1000
  const skew = (idx1 % 5) * 11 * 60 * 1000 // up to ~55m
  const t = now - idx1 * sixHours - skew
  return new Date(t).toISOString()
}

function pickCategory(idx1: number): string {
  return CATEGORY_POOL[idx1 % CATEGORY_POOL.length]
}

function pickPayee(idx1: number): string {
  return PAYEE_POOL[idx1 % PAYEE_POOL.length]
}

function pickMethod(idx1: number): DemoTransaction['payment_method'] {
  return METHOD_POOL[idx1 % METHOD_POOL.length]
}

function maybeNote(idx1: number): string | null {
  if (idx1 % 6 === 0) return 'Auto-generated demo note'
  if (idx1 % 11 === 0) return 'Recurring monthly expense'
  return null
}

function genDemoTransaction(idx1: number): DemoTransaction {
  const occurred_at = generateOccurredAt(idx1)
  const nowIso = new Date().toISOString()
  return {
    id: makeIdFromIndex(idx1),
    amount: generateAmountKRW(idx1),
    currency: 'KRW',
    occurred_at,
    category: pickCategory(idx1),
    payee: pickPayee(idx1),
    payment_method: pickMethod(idx1),
    notes: maybeNote(idx1),
    created_at: nowIso,
    updated_at: nowIso,
  }
}

function buildList(offset: number, limit: number): { items: DemoTransaction[]; hasMore: boolean; nextCursor?: string } {
  if (offset >= TOTAL_ITEMS) {
    return { items: [], hasMore: false }
  }
  const maxIdx = Math.min(TOTAL_ITEMS, offset + limit)
  const items: DemoTransaction[] = []
  for (let i = offset; i < maxIdx; i++) {
    // convert to 1-based index for stable ID/time series ordering (1 = newest)
    const idx1 = i + 1
    items.push(genDemoTransaction(idx1))
  }
  const hasMore = maxIdx < TOTAL_ITEMS
  const nextCursor = hasMore ? String(maxIdx) : undefined
  return { items, hasMore, nextCursor }
}

function json<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return NextResponse.json<T>(data, { ...init, headers })
}

function parseDelay(searchParams: URLSearchParams): number {
  const v = searchParams.get('delay')
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseErrorCode(searchParams: URLSearchParams): number | null {
  const v = searchParams.get('error')
  if (!v) return null
  const n = Number(v)
  if (Number.isFinite(n) && n >= 400 && n < 600) return n
  return 500 // any truthy non-numeric error triggers 500
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sp = url.searchParams

  const errorCode = parseErrorCode(sp)
  const delay = parseDelay(sp)
  if (delay) await sleep(delay)
  if (errorCode) {
    return json(
      { error: 'DemoError', message: 'Forced error for testing state handling', status: errorCode },
      { status: errorCode }
    )
  }

  const limitRaw = parseIntSafe(sp.get('limit'), 20)
  const limit = clamp(limitRaw, 1, 50)
  const cursorRaw = sp.get('cursor')
  const offset = parseIntSafe(cursorRaw, 0)

  const { items, hasMore, nextCursor } = buildList(offset, limit)
  const body: GetResponse = { items, hasMore, ...(nextCursor ? { nextCursor } : {}) }

  const headers = new Headers()
  if (nextCursor) headers.set('x-next-cursor', nextCursor)

  return json<GetResponse>(body, { status: 200, headers })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const sp = url.searchParams

  const errorCode = parseErrorCode(sp)
  const delay = parseDelay(sp)
  if (delay) await sleep(delay)
  if (errorCode) {
    return json(
      { error: 'DemoError', message: 'Forced error for testing state handling', status: errorCode },
      { status: errorCode }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch (e) {
    return json({ error: 'BadRequest', message: 'Invalid JSON body' }, { status: 400 })
  }

  // Accept both `occurred_at` or `date` for convenience per epic description
  const occurredAtInput: string | null = body?.occurred_at ?? body?.date ?? null
  const amountInput = body?.amount

  if (typeof amountInput !== 'number' || !Number.isFinite(amountInput) || amountInput <= 0) {
    return json({ error: 'ValidationError', message: 'Field "amount" must be a positive number' }, { status: 400 })
  }

  const occurredAtDate = occurredAtInput ? new Date(occurredAtInput) : new Date()
  if (Number.isNaN(occurredAtDate.getTime())) {
    return json({ error: 'ValidationError', message: 'Field "occurred_at" must be a valid date/time' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const created: DemoTransaction = {
    id: `txn_new_${crypto.randomUUID()}`,
    amount: Math.round(amountInput),
    currency: 'KRW',
    occurred_at: occurredAtDate.toISOString(),
    category: typeof body?.category === 'string' && body.category.trim() ? body.category.trim() : null,
    payee: typeof body?.payee === 'string' && body.payee.trim() ? body.payee.trim() : null,
    payment_method: (['card', 'cash', 'transfer'] as const).includes(body?.payment_method)
      ? body.payment_method
      : 'card',
    notes: typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    created_at: nowIso,
    updated_at: nowIso,
  }

  // Non-persistent: we simply echo back the created record
  return json<DemoTransaction>(created, { status: 200 })
}
