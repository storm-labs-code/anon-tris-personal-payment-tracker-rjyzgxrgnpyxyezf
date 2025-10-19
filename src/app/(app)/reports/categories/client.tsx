'use client'

/**
 * CODE INSIGHT
 * This client component powers the category breakdown report. It reads URL search params, fetches
 * aggregated spend by category from the API, renders a donut chart and legend with sorting, and
 * navigates to drilldown on chart/legend interactions. It also wires a Supabase Realtime
 * subscription on transactions to auto-invalidate the current dataset.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Doughnut, getElementAtEvent } from 'react-chartjs-2'

ChartJS.register(ArcElement, ChartTooltip)

// Types normalized for this UI
interface CategoryDatum {
  id: string
  name: string
  amount: number
}

interface ApiCategoriesResponse {
  data?: any
  categories?: any
  total?: number
}

const fetcher = async (url: string): Promise<{ items: CategoryDatum[]; total: number }> => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to load categories')
  }
  const json: ApiCategoriesResponse | CategoryDatum[] = await res.json()

  // Normalize possible shapes to { items, total }
  let items: CategoryDatum[] = []
  let total = 0

  const tryNormalize = (arr: any[]): CategoryDatum[] =>
    (arr || []).map((r: any) => {
      const id = r.id ?? r.category_id ?? r.categoryId
      const name = r.name ?? r.category_name ?? r.categoryName
      const amount = Number(
        r.amount ?? r.total_amount ?? r.total ?? r.sum ?? r.value ?? 0
      )
      return { id, name, amount }
    })

  if (Array.isArray(json)) {
    items = tryNormalize(json)
  } else if (json) {
    if (Array.isArray(json.data)) items = tryNormalize(json.data)
    else if (Array.isArray(json.categories)) items = tryNormalize(json.categories)
    if (typeof json.total === 'number') total = json.total
  }

  // Compute total if not provided
  if (!total) total = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)

  return { items, total }
}

const KRW = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

const palette = [
  '#2563EB', // primary
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
  '#F97316',
  '#14B8A6',
  '#3B82F6',
  '#A855F7',
  '#22C55E',
  '#EAB308',
  '#F43F5E',
]

function colorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i)
  return palette[Math.abs(hash) % palette.length]
}

export default function CategoriesClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount')
  const [userId, setUserId] = useState<string | null>(null)

  // Build query string from URL params
  const apiKey = useMemo(() => {
    const params = new URLSearchParams()
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const categoryId = searchParams.get('categoryId')
    const method = searchParams.get('method')
    const tz = searchParams.get('tz')

    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (categoryId) params.set('categoryId', categoryId)
    if (method) params.set('method', method)
    if (tz) params.set('tz', tz)

    return `/api/reports/categories?${params.toString()}`
  }, [searchParams])

  const { data, error, isLoading, mutate } = useSWR(apiKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  const items = data?.items || []
  const total = data?.total || 0

  const displayItems: CategoryDatum[] = useMemo(() => {
    const arr = [...items]
    if (sortBy === 'amount') arr.sort((a, b) => b.amount - a.amount)
    else arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return arr
  }, [items, sortBy])

  const chartRef = useRef<any>(null)

  const chartData = useMemo(() => {
    const labels = displayItems.map((i) => i.name)
    const values = displayItems.map((i) => i.amount)
    const backgroundColor = displayItems.map((i) => colorForId(i.id))

    return {
      labels,
      datasets: [
        {
          label: '카테고리 지출',
          data: values,
          backgroundColor,
          borderWidth: 0,
        },
      ],
    }
  }, [displayItems])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 500,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: true,
        callbacks: {
          label: (ctx: any) => {
            const val = Number(ctx.parsed) || 0
            const pct = total > 0 ? Math.round((val / total) * 100) : 0
            return `${KRW.format(val)} (${pct}%)`
          },
        },
      },
    },
  }), [total])

  const handleSliceClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartRef.current) return
      const elements = getElementAtEvent(chartRef.current, event)
      if (!elements?.length) return
      const idx = elements[0].index
      const picked = displayItems[idx]
      if (!picked) return

      const next = new URLSearchParams(searchParams.toString())
      next.set('categoryId', picked.id)
      const start = searchParams.get('start')
      const end = searchParams.get('end')
      if (start) next.set('start', start)
      if (end) next.set('end', end)

      router.push(`/reports/drilldown?${next.toString()}`)
    },
    [displayItems, router, searchParams]
  )

  // Realtime subscription for live updates
  useEffect(() => {
    let isMounted = true
    supabaseBrowser.auth.getUser().then((res) => {
      if (!isMounted) return
      setUserId(res.data.user?.id ?? null)
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabaseBrowser
      .channel('reports-categories-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate SWR cache for current key
          mutate()
        }
      )

    channel.subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [userId, mutate])

  const isEmpty = !isLoading && !error && (items.length === 0 || total === 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">카테고리 지출</h1>
          <p className="text-sm text-muted-foreground">선택된 기간과 필터에 대한 카테고리별 지출 요약</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
          <button
            onClick={() => setSortBy('amount')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition',
              sortBy === 'amount'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={sortBy === 'amount'}
          >
            금액순
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition',
              sortBy === 'name'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={sortBy === 'name'}
          >
            이름순
          </button>
        </div>
      </div>

      {/* Chart Card */}
      <div className="rounded-xl border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-4 shadow-sm">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-60 md:h-72 flex items-center justify-center">
              <Skeleton className="h-48 w-48 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>불러오기 실패</AlertTitle>
            <AlertDescription className="mt-1">
              데이터를 불러오는 중 문제가 발생했어요. 다시 시도해 주세요.
            </AlertDescription>
            <div className="mt-3">
              <button
                onClick={() => mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow hover:opacity-90"
              >
                다시 시도
              </button>
            </div>
          </Alert>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="text-4xl mb-2">🧾</div>
            <p className="font-medium">표시할 지출이 없어요</p>
            <p className="text-sm text-muted-foreground mt-1">
              선택된 기간과 필터에 해당하는 지출이 없습니다. 새 거래를 추가해보세요.
            </p>
            <Link
              href="/transactions/new"
              className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow hover:opacity-90"
            >
              거래 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative h-60 md:h-72">
              <Doughnut
                ref={chartRef}
                data={chartData}
                options={chartOptions as any}
                onClick={handleSliceClick}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">총 지출</div>
                  <div className="text-lg font-semibold">{KRW.format(total)}</div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="overflow-hidden">
              <ul className="divide-y divide-border rounded-lg border">
                {displayItems.map((item) => {
                  const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0
                  const color = colorForId(item.id)
                  return (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => {
                          const next = new URLSearchParams(searchParams.toString())
                          next.set('categoryId', item.id)
                          router.push(`/reports/drilldown?${next.toString()}`)
                        }}
                        className="group flex flex-1 items-center justify-between"
                        aria-label={`${item.name} 상세 보기`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full ring-2 ring-border"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <div className="text-left">
                            <div className="font-medium leading-none group-hover:underline">
                              {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{pct}%</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{KRW.format(item.amount)}</div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Helpful links */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/reports/overview" className="hover:underline">개요</Link>
        <span>•</span>
        <Link href="/reports/trends" className="hover:underline">추세</Link>
        <span>•</span>
        <Link href="/reports/drilldown" className="hover:underline">목록</Link>
      </div>
    </div>
  )
}
