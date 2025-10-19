'use client'

/**
 * CODE INSIGHT
 * This code's use case is the Reports > Trends client experience: it reads URL search params, fetches
 * rolling 30/90-day trend data from /api/reports/trends via SWR, renders a responsive line chart, and
 * supports drilldown by tapping a point. It also listens to Supabase Realtime for transaction changes
 * to auto-refresh the chart.
 * This code's full epic context is the Reports module with filters in URL and auto-refetch on URL change.
 * This code's ui feel is calm, modern, and mobile-first with a segmented control and subtle animations.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import useSWR from 'swr'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { supabaseBrowser } from '@/utils/supabase/client-browser'
import { cn } from '@/utils/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

function formatDateISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ensureDateStr(s?: string | null) {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const now = new Date()
  return formatDateISO(now)
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to load trends data')
  }
  return res.json()
}

export default function Client() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const tz = sp.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
  const start = sp.get('start') || (() => {
    // Fallback to first day of current month if layout didn't set
    const n = new Date()
    return formatDateISO(new Date(n.getFullYear(), n.getMonth(), 1))
  })()
  const end = sp.get('end') || (() => {
    // Fallback to tomorrow (exclusive upper bound)
    const n = new Date()
    const tomorrow = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1)
    return formatDateISO(tomorrow)
  })()

  const windowParam = sp.get('window')
  const windowSize = windowParam === '90' ? 90 : 30

  const preservedParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('start', ensureDateStr(start))
    params.set('end', ensureDateStr(end))
    params.set('window', String(windowSize))
    const categoryId = sp.get('categoryId')
    const method = sp.get('method')
    if (categoryId) params.set('categoryId', categoryId)
    if (method) params.set('method', method)
    params.set('tz', tz)
    return params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, windowSize, sp, tz])

  const apiUrl = useMemo(() => `/api/reports/trends?${preservedParams.toString()}`, [preservedParams])

  const { data, error, isLoading, isValidating, mutate } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  })

  const points = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.points ?? data?.data ?? [])
    const normalized = (arr || []).map((p: any) => ({
      date: p.date || p.day || p.bucket || p.d,
      total: Number(p.total ?? p.amount ?? p.value ?? p.sum ?? 0),
    })).filter((p: any) => typeof p.date === 'string')
    return normalized
  }, [data])

  const [online, setOnline] = useState<boolean>(typeof window !== 'undefined' ? navigator.onLine : true)
  const [subscribed, setSubscribed] = useState<boolean>(false)

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

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: userData } = await supabaseBrowser.auth.getUser()
      const userId = userData?.user?.id
      if (!userId || !active) return
      const channel = supabaseBrowser
        .channel(`reports-trends-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => {
          mutate()
        })
        .subscribe((status) => {
          setSubscribed(status === 'SUBSCRIBED')
        })

      return () => {
        supabaseBrowser.removeChannel(channel)
      }
    })()

    return () => {
      active = false
    }
  }, [mutate])

  const handleWindowChange = useCallback((value: 30 | 90) => {
    const next = new URLSearchParams(sp.toString())
    next.set('window', String(value))
    if (!next.get('start')) next.set('start', ensureDateStr(start))
    if (!next.get('end')) next.set('end', ensureDateStr(end))
    if (!next.get('tz')) next.set('tz', tz)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [router, pathname, sp, start, end, tz])

  const handlePointClick = useCallback((payload: any) => {
    const date: string | undefined = payload?.date
    if (!date) return
    const next = new URLSearchParams()
    next.set('start', date)
    next.set('end', date)
    const categoryId = sp.get('categoryId')
    const method = sp.get('method')
    if (categoryId) next.set('categoryId', categoryId)
    if (method) next.set('method', method)
    next.set('tz', tz)
    router.push(`/reports/drilldown?${next.toString()}`)
  }, [router, sp, tz])

  const currencyFmt = useMemo(() => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }), [])

  const content = (() => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-[240px] w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTitle>불러오기에 실패했어요</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between">
            <span>네트워크 상태를 확인하고 다시 시도해주세요.</span>
            <button
              onClick={() => mutate()}
              className="ml-4 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              다시 시도
            </button>
          </AlertDescription>
        </Alert>
      )
    }

    if (!points || points.length === 0) {
      return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">이 기간에 표시할 데이터가 없어요.</p>
          <a
            href="/transactions/new"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            결제 추가하기
          </a>
        </div>
      )
    }

    return (
      <div className="w-full">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="trisBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'currentColor' }}
                stroke="currentColor"
                tickMargin={8}
              />
              <YAxis
                width={60}
                tickFormatter={(v) => currencyFmt.format(Number(v))}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                stroke="currentColor"
              />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                formatter={(value: any) => [currencyFmt.format(Number(value)), `${windowSize}일 롤링 합계`]}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 3, stroke: '#2563EB', strokeWidth: 1.5, fill: 'var(--background)', onClick: (_: any, idx: number) => handlePointClick(points[idx]) }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{windowSize}일 롤링 합계 (KRW)</div>
      </div>
    )
  })()

  const statusPill = (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 border',
          !online ? 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : isValidating ? 'border-primary/30 text-primary' : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        )}
        aria-live="polite"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            !online ? 'bg-yellow-500' : isValidating ? 'bg-primary' : 'bg-emerald-500'
          )}
        />
        { !online ? '오프라인' : (isValidating ? '동기화 중…' : (subscribed ? '실시간' : '연결됨')) }
      </span>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">트렌드</h1>
          <span className="text-xs text-muted-foreground">기간: {ensureDateStr(start)} ~ {ensureDateStr(end)}</span>
        </div>
        {statusPill}
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">롤링 윈도우</div>
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <button
              onClick={() => handleWindowChange(30)}
              className={cn(
                'relative rounded-md px-3.5 py-1.5 text-sm transition-colors',
                windowSize === 30 ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={windowSize === 30}
            >
              30일
            </button>
            <button
              onClick={() => handleWindowChange(90)}
              className={cn(
                'relative rounded-md px-3.5 py-1.5 text-sm transition-colors',
                windowSize === 90 ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={windowSize === 90}
            >
              90일
            </button>
          </div>
        </div>
        <div className="px-4 pb-4">{content}</div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a href="/reports/overview" className="group rounded-xl border bg-card p-4 text-card-foreground transition hover:shadow-md">
          <div className="text-sm font-medium">개요로 이동</div>
          <div className="text-xs text-muted-foreground">일/주/월 합계를 살펴보세요</div>
        </a>
        <a href="/reports/categories" className="group rounded-xl border bg-card p-4 text-card-foreground transition hover:shadow-md">
          <div className="text-sm font-medium">카테고리 보기</div>
          <div className="text-xs text-muted-foreground">카테고리별 지출 비중</div>
        </a>
      </div>
    </div>
  )
}
