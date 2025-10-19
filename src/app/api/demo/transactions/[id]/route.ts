/**
 * CODE INSIGHT
 * This code's use case is to provide a demo, non-persistent CRUD API for a single transaction item by id.
 * This code's full epic context is the Tris PWA demo where transactions are managed client-side with SWR and localStorage mirroring; server routes simulate network, latency, and errors without touching a real DB.
 * This code's ui feel is irrelevant (API), but responses are predictable, fast, and shaped for mobile-first list/detail views, supporting latency/error simulation for offline/error testing.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
}

const STORE_KEY = '__TRIS_DEMO_TRANSACTIONS__'

type PaymentMethod = 'card' | 'cash' | 'transfer' | 'bank' | 'mobile' | 'other'

export type DemoTransaction = {
  id: string
  amount: number
  currency: 'KRW'
  occurred_at: string
  category: string | null
  payee: string | null
  payment_method: PaymentMethod
  notes: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
}

declare global {
  // eslint-disable-next-line no-var
  var __TRIS_DEMO_TRANSACTIONS__: Map<string, DemoTransaction> | undefined
}

function store(): Map<string, DemoTransaction> {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map()
  }
  return globalThis[STORE_KEY] as Map<string, DemoTransaction>
}

function parseIntSafe(v: string | null): number | null {
  if (v == null) return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

async function maybeDelay(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const noDelay = sp.get('noDelay') === '1' || sp.get('noDelay') === 'true'
  const explicit = parseIntSafe(sp.get('delay') || sp.get('latency') || sp.get('sleep'))
  if (noDelay) return
  const ms = explicit ?? Math.floor(150 + Math.random() * 350)
  if (ms > 0) await new Promise((res) => setTimeout(res, ms))
}

function maybeError(req: NextRequest): NextResponse | null {
  const sp = req.nextUrl.searchParams
  const err = sp.get('error') || sp.get('fail') || sp.get('forceError')
  if (!err) return null
  const statusGuess = parseIntSafe(err)
  const status = statusGuess && statusGuess >= 400 ? statusGuess : 500
  return NextResponse.json(
    { error: 'Simulated error', status },
    { status, headers: { ...CACHE_HEADERS } }
  )
}

function isValidIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const t = Date.parse(v)
  return Number.isFinite(t)
}

const ALLOWED_METHODS: PaymentMethod[] = ['card', 'cash', 'transfer', 'bank', 'mobile', 'other']

function validatePatch(patch: Record<string, unknown>): { ok: true; data: Partial<DemoTransaction> } | { ok: false; message: string } {
  const out: Partial<DemoTransaction> = {}

  if ('amount' in patch) {
    const amt = typeof patch.amount === 'number' ? patch.amount : Number(patch.amount)
    if (!Number.isFinite(amt) || Math.abs(amt) > 1e12) {
      return { ok: false, message: 'Invalid amount' }
    }
    out.amount = Math.trunc(amt)
  }

  if ('occurred_at' in patch) {
    if (!isValidIsoDate(patch.occurred_at)) return { ok: false, message: 'Invalid occurred_at' }
    out.occurred_at = new Date(String(patch.occurred_at)).toISOString()
  }

  if ('category' in patch) {
    const v = patch.category
    if (v !== null && typeof v !== 'string') return { ok: false, message: 'Invalid category' }
    out.category = v as string | null
  }

  if ('payee' in patch) {
    const v = patch.payee
    if (v !== null && typeof v !== 'string') return { ok: false, message: 'Invalid payee' }
    out.payee = v as string | null
  }

  if ('payment_method' in patch) {
    const v = String(patch.payment_method) as PaymentMethod
    if (!ALLOWED_METHODS.includes(v)) return { ok: false, message: 'Invalid payment_method' }
    out.payment_method = v
  }

  if ('notes' in patch) {
    const v = patch.notes
    if (v !== null && typeof v !== 'string') return { ok: false, message: 'Invalid notes' }
    out.notes = v as string | null
  }

  if ('receipt_url' in patch) {
    const v = patch.receipt_url
    if (v !== null && typeof v !== 'string') return { ok: false, message: 'Invalid receipt_url' }
    out.receipt_url = v as string | null
  }

  // Ignore unknown props intentionally
  return { ok: true, data: out }
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const maybe = maybeError(req)
  if (maybe) return maybe
  await maybeDelay(req)

  const id = ctx.params.id
  const s = store()
  const item = s.get(id)
  if (!item) {
    return NextResponse.json(
      { error: 'Not found', code: 'not_found' },
      { status: 404, headers: { ...CACHE_HEADERS } }
    )
  }
  return NextResponse.json(item, { status: 200, headers: { ...CACHE_HEADERS } })
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const maybe = maybeError(req)
  if (maybe) return maybe
  await maybeDelay(req)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'invalid_request' },
      { status: 400, headers: { ...CACHE_HEADERS } }
    )
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Invalid payload', code: 'invalid_request' },
      { status: 400, headers: { ...CACHE_HEADERS } }
    )
  }

  const s = store()
  const id = ctx.params.id
  const existing = s.get(id)
  if (!existing) {
    return NextResponse.json(
      { error: 'Not found', code: 'not_found' },
      { status: 404, headers: { ...CACHE_HEADERS } }
    )
  }

  const validation = validatePatch(body as Record<string, unknown>)
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message, code: 'invalid_request' },
      { status: 400, headers: { ...CACHE_HEADERS } }
    )
  }

  const now = new Date().toISOString()
  const updated: DemoTransaction = {
    ...existing,
    ...validation.data,
    updated_at: now,
  }
  s.set(id, updated)

  return NextResponse.json(updated, { status: 200, headers: { ...CACHE_HEADERS } })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const maybe = maybeError(req)
  if (maybe) return maybe
  await maybeDelay(req)

  const id = ctx.params.id
  const s = store()
  if (!s.has(id)) {
    return NextResponse.json(
      { error: 'Not found', code: 'not_found' },
      { status: 404, headers: { ...CACHE_HEADERS } }
    )
  }
  s.delete(id)
  return new Response(null, { status: 204, headers: { ...CACHE_HEADERS } })
}
