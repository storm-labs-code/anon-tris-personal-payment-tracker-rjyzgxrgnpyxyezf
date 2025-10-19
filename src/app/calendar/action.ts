'use server'

/**
 * CODE INSIGHT
 * Server actions wrapping internal API routes. These preserve auth cookies and
 * generate absolute URLs using incoming headers so the client can call mutations
 * and queries without directly handling API URLs.
 */

import { headers, cookies } from 'next/headers'

type RangeParams = { from: string; to: string; status?: string }

type GenerateParams = { from: string; to: string }

type PayPayload = { amount?: number; paid_at?: string }

type PatchPayload = { action: 'confirm' | 'skip' | 'snooze'; new_date?: string }

function originFromHeaders() {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  const proto = h.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'http' : 'https')
  const base = host?.startsWith('http') ? host : `${proto}://${host}`
  return base
}

function authHeaders() {
  const c = cookies()
  const cookie = c.toString()
  const hdrs: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) hdrs['cookie'] = cookie
  return hdrs
}

export async function getOccurrencesRange(params: RangeParams) {
  const base = originFromHeaders()
  const qs = new URLSearchParams({ from: params.from, to: params.to })
  if (params.status) qs.set('status', params.status)
  const res = await fetch(`${base}/api/occurrences?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to fetch occurrences: ${res.status}`)
  return res.json()
}

export async function generateOccurrences(params: GenerateParams) {
  const base = originFromHeaders()
  const res = await fetch(`${base}/api/occurrences`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ from: params.from, to: params.to }),
  })
  if (!res.ok) throw new Error(`Failed to generate occurrences: ${res.status}`)
  return res.json()
}

export async function payOccurrence(occurrenceId: string, payload: PayPayload) {
  const base = originFromHeaders()
  const res = await fetch(`${base}/api/occurrences/${encodeURIComponent(occurrenceId)}/pay`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to mark paid: ${res.status}`)
  return res.json()
}

export async function patchOccurrence(occurrenceId: string, payload: PatchPayload) {
  const base = originFromHeaders()
  const res = await fetch(`${base}/api/occurrences/${encodeURIComponent(occurrenceId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update occurrence: ${res.status}`)
  return res.json()
}
