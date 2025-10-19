'use client'

/**
 * CODE INSIGHT
 * This client component fetches demo summary and recent transactions using SWR, renders KPI cards, category chips, and a recent list with skeletons, error handling, and empty states.
 * The component aligns with the PWA/mobile-first flow, provides deep links to Transactions and Reports, and shows a FAB to add a new transaction.
 */

import Link from 'next/link'
import useSWR from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

type CategorySummary = { id?: string; name: string; total: number }

type SummaryResponse = {
  totals?: { today?: number; week?: number; month?: number }
  categories?: CategorySummary[]
  currency?: string
}

type DemoTransaction = {
  id?: string
  amount?: number
  occurred_at?: string
  date?: string
  category?: { id?: string; name?: string } | null
  category_name?: string
  payee?: string | null
  payment_method?: string | null
}

type TransactionsResponse = { items?: DemoTransaction[]; nextCursor?: string } | DemoTransaction[]

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

function formatKRW(value: number | undefined | null): string {
  const n = typeof value === 'number' ? value : 0
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(input?: string | null): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

export default function ClientHomeWidget() {
  const {
    data: summary,
    error: summaryError,
    isLoading: isLoadingSummary,
    mutate: refetchSummary,
  } = useSWR<SummaryResponse>('/api/demo/summary', fetcher)

  const {
    data: txData,
    error: txError,
    isLoading: isLoadingTx,
    mutate: refetchTx,
  } = useSWR<TransactionsResponse>('/api/demo/transactions?limit=5', fetcher)

  const transactions: DemoTransaction[] = Array.isArray(txData) ? txData : txData?.items ?? []
  const totals = summary?.totals || { today: 0, week: 0, month: 0 }
  const hasAnyTotals = (totals.today || 0) > 0 || (totals.week || 0) > 0 || (totals.month || 0) > 0
  const hasAnyTx = transactions.length > 0
  const hasData = hasAnyTotals || hasAnyTx

  const showError = Boolean(summaryError || txError)

  return (
    <div className="space-y-6" aria-live="polite">
      {showError && (
        <Alert variant="destructive" className="border-destructive/30">
          <AlertTitle>Unable to load data</AlertTitle>
          <AlertDescription className="mt-1">
            There was a problem fetching your dashboard. Please try again.
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  refetchSummary()
                  refetchTx()
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm shadow-sm hover:opacity-95 transition"
              >
                Retry
              </button>
              <Link
                href="/offline"
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-input text-sm hover:bg-accent hover:text-accent-foreground transition"
              >
                Offline help
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        {isLoadingSummary ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <Skeleton className="h-4 w-16 mb-3" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <div className="text-xs text-muted-foreground">Today</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{formatKRW(totals.today)}</div>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <div className="text-xs text-muted-foreground">This Week</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{formatKRW(totals.week)}</div>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <div className="text-xs text-muted-foreground">This Month</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{formatKRW(totals.month)}</div>
            </div>
          </>
        )}
      </section>

      {/* Category chips */}
      <section className="rounded-xl bg-card border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Top Categories</h2>
          <Link href="/reports" className="text-xs text-primary hover:underline">
            Open Reports
          </Link>
        </div>
        {isLoadingSummary ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : summary?.categories && summary.categories.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {summary.categories.map((c) => (
              <span
                key={c.id || c.name}
                className="inline-flex items-center gap-2 px-3 h-8 rounded-full border border-border bg-muted/40 text-sm whitespace-nowrap"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{formatKRW(c.total)}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No categories yet. Add a transaction to get started.</div>
        )}
      </section>

      {/* Recent transactions */}
      <section className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent</h2>
          <Link
            href="/transactions"
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <Separator />
        <div className="divide-y divide-border">
          {isLoadingTx ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))
          ) : hasAnyTx ? (
            transactions.map((t) => {
              const id = t.id
              const categoryName = t.category?.name || t.category_name || 'Uncategorized'
              const date = t.occurred_at || t.date || ''
              const payee = t.payee || categoryName
              const amount = typeof t.amount === 'number' ? t.amount : 0

              const content = (
                <div className="p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold">
                      {(payee || categoryName).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{payee}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(date)} · {categoryName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold tabular-nums">{formatKRW(amount)}</div>
                    <svg
                      className="h-4 w-4 text-muted-foreground opacity-70 group-hover:opacity-100 transition"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              )

              return id ? (
                <Link key={id} href={`/transactions/${id}`}>{content}</Link>
              ) : (
                <div key={`${payee}-${date}`}>{content}</div>
              )
            })
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              No recent transactions. Add your first one to see it here.
            </div>
          )}
        </div>
      </section>

      {/* Empty state */}
      {!isLoadingSummary && !isLoadingTx && !showError && !hasData && (
        <section className="rounded-2xl border border-dashed border-border p-6 text-center bg-muted/20">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Track your first payment</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a transaction in KRW to get insights for today, this week, and this month.</p>
          <div className="mt-4">
            <Link
              href="/transactions/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-95 transition"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add transaction
            </Link>
          </div>
        </section>
      )}

      {/* Footer CTAs for navigation */}
      <div className="flex items-center gap-2 justify-between">
        <Link
          href="/transactions"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-input hover:bg-accent hover:text-accent-foreground transition text-sm"
        >
          View all transactions
        </Link>
        <Link
          href="/reports"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:opacity-95 transition text-sm"
        >
          Open Reports
        </Link>
      </div>

      {/* Floating Action Button */}
      <Link
        href="/transactions/new"
        aria-label="Add new transaction"
        className="fixed right-5 bottom-24 sm:bottom-8 inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-95 active:scale-95 transition-transform"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  )
}
