'use client'

/**
 * CODE INSIGHT
 * This client component renders the interactive Reports Overview experience: granularity segmented control,
 * totals header, and a bar chart whose bars navigate to drilldown with computed date buckets. It fetches
 * from /api/reports/aggregate using current URL params, keeps filters in the URL, and listens to Supabase
 * Realtime to invalidate queries for live updates.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title)

type Granularity = 'daily' | 'weekly' | 'monthly'

type AggregatePoint = {
  bucket: string // ISO string or YYYY-MM-DD representing bucket start (in tz)
  total: number
  count: number
  // Optional fields if API provides explicit boundaries
  start?: string
  end?: string
}

type AggregateResponse = {
  points: AggregatePoint[]
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  copy.setUTCDate(copy.getUTCDate() + days)
  return new Date(copy.getUTCFullYear(), copy.getUTCMonth(), copy.getUTCDate())
}

function startOfWeekMonday(d: Date): Date {
  const js = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = js.getDay() // 0..6 Sun..Sat
  const diffToMonday = (day + 6) % 7 // Sun->6, Mon->0, ...
  const res = addDays(js, -diffToMonday)
  return new Date(res.getFullYear(), res.getMonth(), res.getDate())
}

function nextMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function formatKRW(amount: number): string {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('ko-KR')}원`
  }
}

function useGranularity(): [Granularity, (g: Granularity) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('granularity') as Granularity) || 'daily'

  const setGranularity = (g: Granularity) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('granularity', g)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return [current, setGranularity]
}

function getParamOrDefault(searchParams: URLSearchParams, key: string, fallback: string) {
  const v = searchParams.get(key)
  return v && v.length > 0 ? v : fallback
}

function OverviewInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [granularity, setGranularity] = useGranularity()

  // Derive filter params from URL. Defaults align with epic.
  const tz = getParamOrDefault(searchParams, 'tz', 'Asia/Seoul')
  const startDefault = useMemo(() => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return toISODate(first)
  }, [])
  const endDefault = useMemo(() => {
    const now = new Date()
    const tomorrow = addDays(now, 1)
    return toISODate(tomorrow)
  }, [])

  const start = getParamOrDefault(searchParams, 'start', startDefault)
  const end = getParamOrDefault(searchParams, 'end', endDefault)
  const categoryId = searchParams.get('categoryId') || ''
  const method = searchParams.get('method') || ''

  const fetchUrl = useMemo(() => {
    const p = new URLSearchParams()
    p.set('start', start)
    p.set('end', end)
    p.set('granularity', granularity)
    if (categoryId) p.set('categoryId', categoryId)
    if (method) p.set('method', method)
    if (tz) p.set('tz', tz)
    return `/api/reports/aggregate?${p.toString()}`
  }, [start, end, granularity, categoryId, method, tz])

  const { data, isLoading, isError, refetch } = useQuery<AggregateResponse>({
    queryKey: ['reports-aggregate', { start, end, granularity, categoryId, method, tz }],
    queryFn: async ({ signal }) => {
      const res = await fetch(fetchUrl, { signal })
      if (!res.ok) throw new Error('Failed to load aggregate')
      return res.json()
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  // Supabase Realtime: invalidate aggregates on any change to transactions for this user
  useEffect(() => {
    let channel: ReturnType<typeof supabaseBrowser.channel> | null = null
    let active = true

    ;(async () => {
      const { data: userData } = await supabaseBrowser.auth.getUser()
      if (!active) return

      const filter = userData?.user?.id ? `user_id=eq.${userData.user.id}` : undefined
      channel = supabaseBrowser
        .channel('reports-overview-transactions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions', filter },
          () => {
            queryClient.invalidateQueries({ queryKey: ['reports-aggregate'] })
          }
        )
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) supabaseBrowser.removeChannel(channel)
    }
  }, [queryClient])

  const points = data?.points ?? []
  const totalSum = useMemo(() => points.reduce((acc, p) => acc + (p.total || 0), 0), [points])
  const totalCount = useMemo(() => points.reduce((acc, p) => acc + (p.count || 0), 0), [points])

  // Build chart data
  const locale = 'ko-KR'
  function labelForBucket(b: string): string {
    const d = new Date(b)
    if (Number.isNaN(d.getTime())) return b
    if (granularity === 'daily') return d.toLocaleDateString(locale, { month: 'numeric', day: 'numeric', weekday: 'short' })
    if (granularity === 'weekly') {
      const s = startOfWeekMonday(d)
      const e = addDays(s, 6)
      return `${s.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })} - ${e.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}`
    }
    // monthly
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short' })
  }

  const labels = points.map((p) => labelForBucket(p.bucket))

  const primaryColor = 'rgba(37, 99, 235, 0.9)'
  const primaryHover = 'rgba(37, 99, 235, 1)'
  const datasetValues = points.map((p) => p.total)

  const chartData = {
    labels,
    datasets: [
      {
        label: '지출 합계 (KRW)',
        data: datasetValues,
        backgroundColor: primaryColor,
        borderRadius: 8,
        hoverBackgroundColor: primaryHover,
        borderSkipped: false as const,
      },
    ],
  }

  const chartRef = useRef<ChartJS<'bar'>>(null)

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${formatKRW(ctx.parsed.y || 0)}`,
        },
      },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, minRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: {
          callback: (value: any) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(Number(value)),
        },
      },
    },
    onClick: (_: any, elements: any[]) => {
      if (!elements || elements.length === 0) return
      const el = elements[0]
      const index = el.index
      const p = points[index]
      if (!p) return

      const bucketStart = p.start || p.bucket
      const bucketEnd = p.end || (() => {
        const d = new Date(bucketStart)
        if (granularity === 'daily') return toISODate(addDays(d, 1))
        if (granularity === 'weekly') return toISODate(addDays(startOfWeekMonday(d), 7))
        return toISODate(nextMonthStart(d))
      })()

      const params = new URLSearchParams(searchParams.toString())
      params.set('start', toISODate(new Date(bucketStart)))
      params.set('end', bucketEnd)
      // preserve categoryId, method, tz if present; keep them as is
      // move to drilldown
      router.push(`/reports/drilldown?${params.toString()}`)
    },
  }), [points, granularity, searchParams, router])

  const categoriesLink = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('granularity')
    return `/reports/categories?${params.toString()}`
  }, [searchParams])

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">기간 합계</div>
          <div className="text-2xl font-semibold tracking-tight">{formatKRW(totalSum)}</div>
          <div className="text-xs text-muted-foreground">{totalCount.toLocaleString('ko-KR')} 건</div>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm">
          {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                granularity === g
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={granularity === g}
            >
              {g === 'daily' ? 'Daily' : g === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 md:p-4 shadow-sm">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <div className="h-64 md:h-80 w-full rounded-md bg-muted/60 animate-pulse" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>불러오기 실패</AlertTitle>
            <AlertDescription>
              데이터를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.
              <button
                onClick={() => refetch()}
                className="ml-3 inline-flex items-center rounded-md bg-destructive text-destructive-foreground px-3 py-1 text-sm font-medium hover:opacity-90"
              >
                다시 시도
              </button>
            </AlertDescription>
          </Alert>
        ) : points.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="text-base font-medium">해당 기간의 지출이 없습니다</div>
            <div className="text-sm text-muted-foreground">새 거래를 추가해보세요.</div>
            <Link
              href="/transactions/new"
              className="mt-2 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
            >
              거래 추가
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-64 md:h-80">
              <Bar ref={chartRef} data={chartData as any} options={chartOptions as any} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        <Link
          href={categoriesLink}
          className="text-sm text-primary hover:underline underline-offset-4"
        >
          See category breakdown
        </Link>
      </div>
    </div>
  )
}

export default function Client() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        gcTime: 5 * 60 * 1000,
      },
    },
  }))

  return (
    <QueryClientProvider client={client}>
      <OverviewInner />
    </QueryClientProvider>
  )
}
