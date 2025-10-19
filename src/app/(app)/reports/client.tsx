'use client'

/**
 * CODE INSIGHT
 * Client component for Reports. Manages range via URL, fetches /api/demo/summary with SWR,
 * renders trend and category charts via dynamic imports, and provides accessible summaries
 * with polished mobile-first cards and states (loading, error, empty).
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

// Dynamically import chart components and ensure chart.js/auto is loaded only on client
const Line = dynamic(async () => {
  await import('chart.js/auto')
  const mod = await import('react-chartjs-2')
  return mod.Line
}, { ssr: false, loading: () => <div className="h-48 w-full"><Skeleton className="h-full w-full rounded-xl" /></div> })

const Doughnut = dynamic(async () => {
  await import('chart.js/auto')
  const mod = await import('react-chartjs-2')
  return mod.Doughnut
}, { ssr: false, loading: () => <div className="h-48 w-full"><Skeleton className="h-full w-full rounded-xl" /></div> })

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

interface DayPoint { date: string; total: number }
interface CategoryPoint { name: string; total: number }
interface SummaryResponse {
  range?: number
  currency?: string
  totalsByDay?: DayPoint[]
  categories?: CategoryPoint[]
  total?: number
  average?: number
}

export default function ReportsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedRange = useMemo(() => {
    const r = searchParams.get('range') || '30'
    return ['7','30','90'].includes(r) ? r : '30'
  }, [searchParams])

  const { data, error, isLoading, mutate } = useSWR<SummaryResponse>(`/api/demo/summary?range=${selectedRange}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })

  const currency = data?.currency || 'KRW'
  const nf = useMemo(() => new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }), [currency])

  const totalsByDay = data?.totalsByDay || []
  const categories = data?.categories || []
  const total = data?.total ?? totalsByDay.reduce((s, d) => s + (d.total || 0), 0)
  const avg = data?.average ?? (totalsByDay.length ? total / totalsByDay.length : 0)

  const isEmpty = !isLoading && !error && totalsByDay.length === 0 && categories.length === 0

  const onChangeRange = (r: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('range', r)
    router.replace(`?${current.toString()}`, { scroll: false })
  }

  const trendLabels = totalsByDay.map(d => {
    const dt = new Date(d.date)
    // Compact date label for ko-KR
    return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(dt)
  })
  const trendData = totalsByDay.map(d => d.total)

  const palette = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#E11D48'
  ]

  const topCategory = categories
    .slice()
    .sort((a,b) => (b.total || 0) - (a.total || 0))[0]

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1 shadow-sm ring-1 ring-border">
          {(['7','30','90'] as const).map(r => (
            <button
              key={r}
              onClick={() => onChangeRange(r)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedRange === r ? 'bg-primary text-primary-foreground shadow' : 'text-foreground/80 hover:text-foreground'}`}
              aria-pressed={selectedRange === r}
            >
              {r}d
            </button>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          Showing last {selectedRange} days
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTitle>Unable to load reports</AlertTitle>
          <AlertDescription>
            There was a problem fetching your summary. You can retry below.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => mutate()}
                className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
              <Link
                href="/settings"
                className="inline-flex items-center rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Settings
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Total spend</div>
          <div className="mt-2 text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : nf.format(Math.round(total))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Period: last {selectedRange} days</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Average per day</div>
          <div className="mt-2 text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : nf.format(Math.round(avg))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">KRW formatted</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Top category</div>
          <div className="mt-2 text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-32" /> : (topCategory ? topCategory.name : '—')}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {isLoading ? <Skeleton className="h-4 w-24" /> : (topCategory ? nf.format(Math.round(topCategory.total || 0)) : 'No data')}
          </div>
        </div>
      </div>

      {/* Trend chart card */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Spending trend</h2>
          <div className="text-xs text-muted-foreground">Line chart</div>
        </div>
        <Separator className="my-4" />

        {isLoading ? (
          <div className="h-48 w-full"><Skeleton className="h-full w-full rounded-xl" /></div>
        ) : isEmpty || trendData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="text-sm text-muted-foreground">No data to display for this range.</div>
            <div className="flex gap-2">
              <Link href="/transactions/new" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                Add a transaction
              </Link>
              <Link href="/transactions" className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/90">
                View list
              </Link>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <Line
              data={{
                labels: trendLabels,
                datasets: [
                  {
                    label: 'Spend',
                    data: trendData,
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' as const } },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { callback: (v) => nf.format(Number(v)) } },
                },
              }}
            />
            <p className="sr-only" aria-live="polite">
              Total spending over the last {selectedRange} days is {nf.format(Math.round(total))}. Average per day is {nf.format(Math.round(avg))}.
            </p>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">By category</h2>
          <div className="text-xs text-muted-foreground">Doughnut chart</div>
        </div>
        <Separator className="my-4" />
        {isLoading ? (
          <div className="h-48 w-full"><Skeleton className="h-full w-full rounded-xl" /></div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="text-sm text-muted-foreground">No categories found for this period.</div>
            <Link href="/transactions/new" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              Add a transaction
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <div className="md:col-span-3 h-72">
              <Doughnut
                data={{
                  labels: categories.map(c => c.name),
                  datasets: [{
                    label: 'Spend',
                    data: categories.map(c => c.total),
                    backgroundColor: categories.map((_, i) => palette[i % palette.length] + '33'),
                    borderColor: categories.map((_, i) => palette[i % palette.length]),
                    borderWidth: 2,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' as const } },
                }}
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              {categories
                .slice()
                .sort((a,b) => (b.total || 0) - (a.total || 0))
                .map((c, idx) => (
                  <div key={c.name + idx} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <span className="text-sm tabular-nums">{nf.format(Math.round(c.total || 0))}</span>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Helpful links */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="text-sm text-muted-foreground">Keep your data fresh for accurate reports.</div>
        <div className="flex gap-2">
          <Link href="/transactions/new" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">Add transaction</Link>
          <Link href="/transactions" className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/90">Transactions</Link>
        </div>
      </div>
    </div>
  )
}
