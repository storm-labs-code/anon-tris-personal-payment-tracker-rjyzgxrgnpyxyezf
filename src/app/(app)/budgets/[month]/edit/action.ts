"use server"

/**
 * CODE INSIGHT
 * This code's use case is to provide server actions that proxy budget updates and month resets to the app's API routes while forwarding auth cookies.
 * This code's full epic context is the Budgets flow: client form calls these actions to PUT/DELETE /api/budgets, enabling secure updates.
 * This code's ui feel is not applicable; this is server-only logic facilitating seamless data mutations.
 */

import { cookies, headers } from 'next/headers'

type UUID = string

type BudgetRow = {
  category_id: UUID | null
  amount: number
  alert_threshold_percent?: number
}

function resolveBaseUrl(): string {
  const hdrs = headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function forwardCookieHeader(): string | undefined {
  const store = cookies()
  const all = store.getAll()
  if (!all.length) return undefined
  return all.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
}

export async function putBudgets({ month, budgets }: { month: string; budgets: BudgetRow[] }) {
  const base = resolveBaseUrl()
  const res = await fetch(`${base}/api/budgets`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(forwardCookieHeader() ? { cookie: forwardCookieHeader()! } : {}),
    },
    body: JSON.stringify({ month, budgets }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to save budgets')
  }
  return res.json().catch(() => ({}))
}

export async function deleteBudgets(month: string) {
  const base = resolveBaseUrl()
  const url = new URL(`${base}/api/budgets`)
  url.searchParams.set('month', month)
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      ...(forwardCookieHeader() ? { cookie: forwardCookieHeader()! } : {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to reset budgets')
  }
  return res.json().catch(() => ({}))
}
