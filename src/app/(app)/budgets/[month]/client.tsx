'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { acknowledgeBudgetAlert } from './action'

type BudgetStatus = 'ok' | 'approaching' | 'exceeded' | 'no_budget'

type OverallSummary = {
  budget_amount: number | null
  spent: number
  remaining: number | null
  percent: number | null
  threshold_pct: number | null
  status: BudgetStatus
  alert_suppressed?: boolean
}

type CategorySummary = {
  category_id: string
  name: string
  is_favorite?: boolean
  budget_amount: number | null
  spent: number
  remaining: number | null
  percent: number | null
  threshold_pct: number | null
  status: BudgetStatus
  alert_suppressed?: boolean
}

type SummaryResponse = {
  month: string // YYYY-MM
  overall: OverallSummary
  categories: CategorySummary[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to load')
  }
  return (await res.json()) as SummaryResponse
}

function formatKRW(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '₩0'
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `₩${Math.round(value).toLocaleString('ko-KR')}`
  }
}

function getStatusColors(status: BudgetStatus) {
  switch (status) {
    case 'ok':
      return {
        bar: 'bg-primary',
        text: 'text-primary',
        badge: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
      }
    case 'approaching':
      return {
        bar: 'bg-amber-500',
        text: 'text-amber-600',
        badge: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
      }
    case 'exceeded':
      return {
        bar: 'bg-destructive',
        text: 'text-destructive',
        badge: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
      }
    case 'no_budget':
    default:
      return {
        bar: 'bg-muted',
        text: 'text-muted-foreground',
        badge: 'text-muted-foreground bg-muted',
      }
  }
}

function clampPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function nextMonthStr(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() + 1)
  const ny = d.getUTCFullYear()
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}`
}

function prevMonthStr(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  const ny = d.getUTCFullYear()
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}`
}

function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
}

function StatusBadge({ status }: { status: BudgetStatus }) {
  const colors = getStatusColors(status)
  const text =
    status === 'ok'
      ? '정상'
      : status === 'approaching'
      ? '임계치 근접'
      : status === 'exceeded'
      ? '초과'
      : '예산 없음'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
      {text}
    </span>
  )
}

function ProgressBar({ percent, status }: { percent: number; status: BudgetStatus }) {
  const colors = getStatusColors(status)
  const width = clampPercent(percent)
  return (
    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full ${colors.bar} transition-[width] duration-500 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
  )
}

function CardHeader({ title, action, subtitle }: { title: React.ReactNode; action?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-semibold leading-6">{title}</h3>
        {subtitle ? <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-5 pt-0 space-y-3 sm:space-y-4">{children}</div>
}

export default function BudgetsMonthClient({ month }: { month: string }) {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR(`/api/budgets/summary?month=${encodeURIComponent(month)}`, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  const [isOnline, setIsOnline] = React.useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [locallyDismissed, setLocallyDismissed] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  React.useEffect(() => {
    // Clear local dismissals when month changes
    setLocallyDismissed(new Set())
  }, [month])

  const onPrev = React.useCallback(() => {
    router.push(`/budgets/${prevMonthStr(month)}`)
  }, [router, month])

  const onNext = React.useCallback(() => {
    router.push(`/budgets/${nextMonthStr(month)}`)
  }, [router, month])

  const onPickMonth: React.ChangeEventHandler<HTMLInputElement> = React.useCallback(
    (e) => {
      const val = e.target.value
      if (/^\d{4}-\d{2}$/.test(val)) {
        router.push(`/budgets/${val}`)
      }
    },
    [router]
  )

  const handleDismissAlert = React.useCallback(
    async (categoryId: string | null, status: BudgetStatus) => {
      const key = `${month}|${categoryId ?? 'overall'}|${status}`
      setLocallyDismissed((prev) => new Set(prev).add(key))
      try {
        await acknowledgeBudgetAlert({ month, category_id: categoryId, status })
        // Optionally revalidate summary in background so suppress flag updates
        mutate()
      } catch (e) {
        // rollback local dismiss on error
        setLocallyDismissed((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    },
    [month, mutate]
  )

  const alerts = React.useMemo(() => {
    const items: { id: string; title: string; desc: string; status: BudgetStatus; categoryId: string | null }[] = []
    if (data) {
      const o = data.overall
      const overallKey = `${month}|overall|${o.status}`
      if ((o.status === 'approaching' || o.status === 'exceeded') && !o.alert_suppressed && !locallyDismissed.has(overallKey)) {
        items.push({
          id: overallKey,
          title: o.status === 'exceeded' ? '전체 예산 초과' : '전체 예산 임계치 근접',
          desc: `이번 달 전체 지출: ${formatKRW(o.spent)}${o.budget_amount ? ` / 예산 ${formatKRW(o.budget_amount)}` : ''}`,
          status: o.status,
          categoryId: null,
        })
      }
      for (const c of data.categories) {
        const key = `${month}|${c.category_id}|${c.status}`
        if ((c.status === 'approaching' || c.status === 'exceeded') && !c.alert_suppressed && !locallyDismissed.has(key)) {
          items.push({
            id: key,
            title: `${c.name} ${c.status === 'exceeded' ? '예산 초과' : '임계치 근접'}`,
            desc: `${c.name} 지출: ${formatKRW(c.spent)}${c.budget_amount ? ` / 예산 ${formatKRW(c.budget_amount)}` : ''}`,
            status: c.status,
            categoryId: c.category_id,
          })
        }
      }
    }
    return items
  }, [data, locallyDismissed, month])

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            aria-label="이전 달"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted active:scale-95 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M15.78 4.22a.75.75 0 010 1.06L9.06 12l6.72 6.72a.75.75 0 11-1.06 1.06l-7.25-7.25a.75.75 0 010-1.06l7.25-7.25a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>
          </button>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">예산 개요</h1>
            <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={onPickMonth}
            aria-label="월 선택"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={onNext}
            aria-label="다음 달"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted active:scale-95 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.22 19.78a.75.75 0 010-1.06L14.94 12 8.22 5.28a.75.75 0 011.06-1.06l7.25 7.25a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0z" clipRule="evenodd"/></svg>
          </button>
          <Link
            href={`/budgets/${month}/edit`}
            className="inline-flex items-center gap-2 h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:opacity-90 active:scale-95 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M4 17.25V20h2.75l8.06-8.06-2.75-2.75L4 17.25z"/><path d="M14.06 4.94l2.75 2.75 1.44-1.44a1.5 1.5 0 000-2.12l-.63-.63a1.5 1.5 0 00-2.12 0l-1.44 1.44z"/></svg>
            예산 편집
          </Link>
        </div>
      </section>

      {!isOnline && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTitle>오프라인 모드</AlertTitle>
          <AlertDescription>인터넷 연결이 없습니다. 캐시된 데이터를 표시합니다.</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      )}

      {error && (
        <Alert className="border-destructive text-destructive">
          <AlertTitle>불러오기 실패</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            데이터를 불러오는 중 오류가 발생했습니다.
            <button
              onClick={() => mutate()}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              다시 시도
            </button>
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a) => (
                <Alert key={a.id} className={a.status === 'exceeded' ? 'border-destructive text-destructive' : 'border-amber-400 text-amber-700 dark:text-amber-200'}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <AlertTitle className="font-semibold">{a.title}</AlertTitle>
                      <AlertDescription className="text-sm">{a.desc}</AlertDescription>
                    </div>
                    <button
                      onClick={() => handleDismissAlert(a.categoryId, a.status)}
                      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-2 text-xs hover:bg-muted"
                      aria-label="경고 닫기"
                    >
                      닫기
                    </button>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <span>전체 예산</span>
                    <StatusBadge status={data.overall.status} />
                  </div>
                }
                subtitle="이번 달 전체 지출 현황"
              />
              <CardContent>
                <div className="space-y-3">
                  <ProgressBar percent={data.overall.percent ?? 0} status={data.overall.status} />
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <MetricRow label="지출" value={formatKRW(data.overall.spent)} />
                    <MetricRow label="예산" value={data.overall.budget_amount ? formatKRW(data.overall.budget_amount) : '—'} />
                    <MetricRow label="잔여" value={data.overall.remaining != null ? formatKRW(data.overall.remaining) : '—'} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title={<span>카테고리</span>} subtitle="카테고리별 예산 사용 현황" />
              <CardContent>
                {data.categories.length === 0 ? (
                  <div className="text-sm text-muted-foreground">카테고리가 없습니다. 상단의 "예산 편집"에서 예산을 설정해보세요.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {data.categories
                      .slice()
                      .sort((a, b) => Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite)))
                      .map((c) => {
                        const colors = getStatusColors(c.status)
                        return (
                          <div key={c.category_id} className="rounded-lg border border-border p-3 hover:shadow-sm transition bg-card">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{c.name}</span>
                                  <StatusBadge status={c.status} />
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {c.budget_amount ? `예산 ${formatKRW(c.budget_amount)}` : '예산 미설정'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Link
                                  href={`/budgets/${month}/edit?categoryId=${c.category_id}`}
                                  className="inline-flex items-center rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
                                >
                                  조정
                                </Link>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <ProgressBar percent={c.percent ?? 0} status={c.status} />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">지출</span>
                                <span className={`font-medium ${colors.text}`}>{formatKRW(c.spent)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">잔여</span>
                                <span className="font-medium">{c.remaining != null ? formatKRW(c.remaining) : '—'}</span>
                              </div>
                              <div className="pt-1">
                                <Link
                                  href={`/transactions?month=${encodeURIComponent(month)}&categoryId=${encodeURIComponent(c.category_id)}`}
                                  className="inline-flex items-center text-xs text-primary hover:underline"
                                >
                                  내역 보기
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-3.5 w-3.5"><path fillRule="evenodd" d="M4.5 12a.75.75 0 01.75-.75h12.19l-4.22-4.22a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 11-1.06-1.06l4.22-4.22H5.25A.75.75 0 014.5 12z" clipRule="evenodd"/></svg>
                                </Link>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
