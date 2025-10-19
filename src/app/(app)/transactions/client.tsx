'use client'

/**
 * CODE INSIGHT
 * This client component powers the Transactions list with search, filters, infinite scroll, and quick actions using the demo API.
 * Data flow adheres to the epic: fetch via SWR from /api/demo/transactions using cursor pagination; update URL cursor via shallow push; handle back/forward via popstate.
 * UI is mobile-first with smooth feedback, KRW formatting, and accessible states (loading, empty, error).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/utils/utils'

interface ClientProps {
  initialCursor: string | null
}

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other' | string

type DemoTransaction = {
  id: string
  amount: number
  occurred_at: string
  category?: string | null
  category_id?: string | null
  payee?: string | null
  payment_method: PaymentMethod
  notes?: string | null
}

type DemoPage = {
  items: DemoTransaction[]
  nextCursor: string | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return (await res.json()) as DemoPage
}

const KRW = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' })

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return iso
  }
}

const FILTERS: { key: string; label: string; method?: PaymentMethod }[] = [
  { key: 'all', label: 'All' },
  { key: 'cash', label: 'Cash', method: 'cash' },
  { key: 'card', label: 'Card', method: 'card' },
  { key: 'transfer', label: 'Transfer', method: 'transfer' },
  { key: 'other', label: 'Other', method: 'other' },
]

export default function Client({ initialCursor }: ClientProps) {
  const router = useRouter()
  const [baseCursor, setBaseCursor] = useState<string | null>(initialCursor)
  const [query, setQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const getKey = useCallback(
    (pageIndex: number, previousPageData: DemoPage | null) => {
      if (previousPageData && previousPageData.nextCursor === null) return null
      const limit = 20
      const cursor = pageIndex === 0 ? baseCursor : previousPageData?.nextCursor
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (cursor) params.set('cursor', cursor)
      return `/api/demo/transactions?${params.toString()}`
    },
    [baseCursor]
  )

  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<DemoPage>(getKey, fetcher, {
    revalidateOnFocus: false,
    revalidateFirstPage: true,
  })

  const items = useMemo(() => (data ? data.flatMap((p) => p.items) : []), [data])
  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : true
  const isLoadingInitial = !data && !error
  const isLoadingMore = isValidating && !!data

  // URL cursor shallow update on pagination
  const pushedCursorRef = useRef<string | null>(initialCursor || null)
  useEffect(() => {
    if (!data || data.length === 0) return
    const currentCursor = data[data.length - 1]?.nextCursor
    if (currentCursor && pushedCursorRef.current !== currentCursor) {
      const url = new URL(window.location.href)
      url.searchParams.set('cursor', currentCursor)
      window.history.pushState({ cursor: currentCursor }, '', url)
      pushedCursorRef.current = currentCursor
    }
    if (!currentCursor) {
      // If no next cursor, remove the param to indicate end
      const url = new URL(window.location.href)
      url.searchParams.delete('cursor')
      if (pushedCursorRef.current !== null) {
        window.history.pushState({ cursor: null }, '', url)
        pushedCursorRef.current = null
      }
    }
  }, [data])

  // Handle back/forward to rebuild list from a base cursor
  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href)
      const c = url.searchParams.get('cursor')
      setBaseCursor(c)
      pushedCursorRef.current = c
      // Reset list to the new base cursor
      mutate([], false)
      setSize(1)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [mutate, setSize])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first.isIntersecting && !isLoadingMore && hasMore && !error) {
          setSize((s) => s + 1)
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isLoadingMore, hasMore, error, setSize])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((t) => {
      const matchMethod = methodFilter === 'all' ? true : (t.payment_method || '').toLowerCase() === methodFilter
      if (!q) return matchMethod
      const hay = `${t.payee || ''} ${t.notes || ''} ${t.category || ''}`.toLowerCase()
      return matchMethod && hay.includes(q)
    })
  }, [items, query, methodFilter])

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = window.confirm('Delete this transaction? This cannot be undone in the demo.')
      if (!ok) return
      setDeletingIds((s) => ({ ...s, [id]: true }))
      try {
        const res = await fetch(`/api/demo/transactions/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete')
        await mutate(
          (pages) => {
            if (!pages) return pages
            return pages.map((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }))
          },
          { revalidate: false }
        )
      } catch (e) {
        alert('Could not delete. Please try again.')
      } finally {
        setDeletingIds((s) => ({ ...s, [id]: false }))
      }
    },
    [mutate]
  )

  return (
    <div className="relative">
      {/* Status bar */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                aria-label="Search transactions"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search payee, notes…"
                className="w-full rounded-xl bg-muted/60 text-sm px-10 py-2 outline-none ring-1 ring-input focus:ring-2 focus:ring-primary transition"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none">🔎</span>
              {query && (
                <button
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  aria-pressed={methodFilter === f.key}
                  onClick={() => setMethodFilter(f.key)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition',
                    methodFilter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {!online && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 text-xs px-2 py-1 ring-1 ring-amber-500/30">
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4">
          <Alert className="border-destructive/30">
            <AlertTitle>We couldn’t load your transactions</AlertTitle>
            <AlertDescription>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-muted-foreground">Please check your connection and try again.</span>
                <button
                  onClick={() => mutate()}
                  className="ml-auto inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition"
                >
                  Retry
                </button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {isLoadingInitial && (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-2 flex items-center gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoadingInitial && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center bg-card">
            <h2 className="text-lg font-medium">No transactions yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first transaction to get started. You can attach a receipt later.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/transactions/new"
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                + New Transaction
              </Link>
              <button
                onClick={() => {
                  setQuery('')
                  setMethodFilter('all')
                }}
                className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        <ul role="list" className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="group relative overflow-hidden rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-1 rounded-full bg-primary/70" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/transactions/${t.id}`}
                        className="block text-sm font-medium hover:underline truncate"
                        prefetch={true}
                      >
                        {t.payee || 'Untitled'}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {t.category && (
                          <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5">{t.category}</span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 capitalize">
                          {t.payment_method || 'other'}
                        </span>
                        {t.notes && <span className="truncate max-w-[12rem]">{t.notes}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{KRW.format(t.amount || 0)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{formatDate(t.occurred_at)}</div>
                    </div>
                  </div>
                </div>
                <div className="-mr-1 flex flex-col gap-2">
                  <Link
                    href={`/transactions/${t.id}`}
                    className="opacity-0 group-hover:opacity-100 inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition"
                    title="View details"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={!!deletingIds[t.id]}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 inline-flex items-center rounded-md border border-border px-2 py-1 text-xs transition',
                      deletingIds[t.id]
                        ? 'bg-destructive/10 text-destructive cursor-wait'
                        : 'bg-background hover:bg-destructive hover:text-destructive-foreground border-destructive/50'
                    )}
                    title="Delete"
                  >
                    {deletingIds[t.id] ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Load more / sentinel */}
        {!isLoadingInitial && filtered.length > 0 && (
          <>
            {isLoadingMore && (
              <div className="grid grid-cols-1 gap-2 mt-2" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}
            <div ref={sentinelRef} className="h-10" aria-hidden />
            {!hasMore && (
              <div className="text-center text-xs text-muted-foreground py-2">You’re all caught up</div>
            )}
            {hasMore && (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setSize((s) => s + 1)}
                  disabled={isLoadingMore}
                  className="mt-2 inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 sm:bottom-8 flex justify-center">
        <Link
          href="/transactions/new"
          className="pointer-events-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg w-14 h-14 text-2xl hover:opacity-90 active:scale-95 transition"
          aria-label="Add transaction"
        >
          +
        </Link>
      </div>

      <Separator className="my-6" />
    </div>
  )
}
